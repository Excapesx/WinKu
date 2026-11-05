package io.github.jackwener.dsh.core.provider

import android.content.ContextWrapper
import androidx.test.platform.app.InstrumentationRegistry
import io.github.jackwener.dsh.core.data.SecretStore
import io.github.jackwener.dsh.core.data.ModelSettingsMigration
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.net.ServerSocket
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** Real Android Keystore and HTTP stack; isolated slots and a loopback test endpoint, no external API keys. */
class ModelConfigurationTest {
    @Test fun encryptedLegacyKeyMigratesToAnOrdinaryProviderSlot() = runBlocking {
        val base = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(base.cacheDir, "model-key-test-${UUID.randomUUID()}").apply { mkdirs() }
        val isolated = object : ContextWrapper(base) { override fun getNoBackupFilesDir() = directory }
        val legacy = SecretStore(isolated)
        try {
            legacy.write("fixture", "test-legacy-key")
            File(directory, "secret-fixture.key").copyTo(File(directory, "deepseek.key"))
            val migration = ModelSettingsMigration(legacy::readLegacyModelKey, legacy::write, legacy::clearLegacyModelKey)
            val migrated = migration.migrate(emptyPreferences())
            val p = Json.decodeFromString(ListSerializer(ProviderConfig.serializer()), migrated[stringPreferencesKey("providers_json")]!!).single()
            val upgraded = SecretStore(isolated)
            assertEquals("test-legacy-key", upgraded.read(p.secretName))
            assertTrue(File(directory, "deepseek.key").exists())
            migration.cleanUp()
            assertFalse(File(directory, "deepseek.key").exists())
            upgraded.write(p.secretName, "test-rotated-key")
            assertEquals("test-rotated-key", SecretStore(isolated).read(p.secretName))
            assertFalse(File(directory, "secret-${p.secretName}.key").readText().contains("test-rotated-key"))
            upgraded.clear(p.secretName)
            assertNull(SecretStore(isolated).read(p.secretName))
        } finally { directory.listFiles()?.forEach { it.delete() }; directory.delete() }
    }

    @Test fun connectionProbeSendsExactlySelectedModelAndKey() {
        val reply = """{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"test","type":"function","function":{"name":"$PROBE_TOOL","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}"""
        withEndpoint(200, reply) { baseUrl, request ->
            assertNull(probeModel(baseUrl, "test-provider-key", "selected-model"))
            val wire = request()
            assertTrue(wire.first.startsWith("POST /v1/chat/completions "))
            assertTrue(wire.first.contains("Authorization: Bearer test-provider-key", ignoreCase = true))
            assertEquals("selected-model", Json.parseToJsonElement(wire.second).jsonObject["model"]!!.jsonPrimitive.content)
        }
    }

    @Test fun invalidKeyAndUnavailableModelRemainDistinct() {
        withEndpoint(401, """{"error":{"message":"invalid api key"}}""") { baseUrl, _ ->
            assertTrue(probeModel(baseUrl, "test-invalid-key", "selected-model") is VerifyFailure.KeyInvalid)
        }
        withEndpoint(404, """{"error":{"message":"model not found","code":"model_not_found"}}""") { baseUrl, _ ->
            assertTrue(probeModel(baseUrl, "test-provider-key", "missing-model") is VerifyFailure.ModelNotFound)
        }
    }

    @Test fun nativeProtocolsUseTheirOwnPathsAndAuthentication() {
        withEndpoint(200, """{"content":[{"type":"tool_use","id":"t","name":"$PROBE_TOOL","input":{}}]}""") { url, request ->
            assertNull(probeModel(url, "test-messages-key", "selected-claude", protocol = ProviderProtocol.Messages))
            val wire = request()
            assertTrue(wire.first.startsWith("POST /v1/messages "))
            assertTrue(wire.first.contains("x-api-key: test-messages-key", true))
            assertTrue(wire.first.contains("anthropic-version: 2023-06-01", true))
            assertFalse(wire.first.contains("Authorization:", true))
            assertTrue(wire.first.contains("User-Agent: WinKu", true))
            assertEquals("selected-claude", Json.parseToJsonElement(wire.second).jsonObject["model"]!!.jsonPrimitive.content)
        }
        withEndpoint(200, """{"output":[{"type":"function_call","name":"$PROBE_TOOL","arguments":"{}","call_id":"t"}]}""") { url, request ->
            assertNull(probeModel(url, "test-responses-key", "selected-gpt", protocol = ProviderProtocol.Responses))
            val wire = request()
            assertTrue(wire.first.startsWith("POST /v1/responses "))
            assertTrue(wire.first.contains("Authorization: Bearer test-responses-key", true))
            assertEquals("selected-gpt", Json.parseToJsonElement(wire.second).jsonObject["model"]!!.jsonPrimitive.content)
        }
    }

    private fun withEndpoint(status: Int, body: String, action: (String, () -> Pair<String, String>) -> Unit) {
        ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1")).use { server ->
            server.soTimeout = 15000
            val captured = AtomicReference<Pair<String, String>>()
            val serverError = AtomicReference<Throwable>()
            val worker = Thread {
                try {
                    server.accept().use { socket ->
                        socket.soTimeout = 15000
                        val reader = socket.getInputStream().bufferedReader()
                        val lines = mutableListOf<String>()
                        while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break; lines += line }
                        val length = lines.firstOrNull { it.startsWith("content-length:", true) }?.substringAfter(':')?.trim()?.toInt() ?: 0
                        val chars = CharArray(length)
                        var read = 0
                        while (read < length) { val n = reader.read(chars, read, length - read); check(n > 0); read += n }
                        captured.set(lines.joinToString("\n") to String(chars))
                        val bytes = body.toByteArray()
                        socket.getOutputStream().apply {
                            write("HTTP/1.1 $status Test\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                            write(bytes); flush()
                        }
                    }
                } catch (t: Throwable) { serverError.set(t) }
            }.apply { start() }
            try { action("http://127.0.0.1:${server.localPort}/v1") { captured.get() ?: error("no request captured") } }
            finally { server.close(); worker.join(16000) }
            serverError.get()?.let { throw AssertionError("Test endpoint failed", it) }
        }
    }
}
