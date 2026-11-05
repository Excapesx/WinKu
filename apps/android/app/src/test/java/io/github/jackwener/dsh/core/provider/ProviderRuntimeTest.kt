package io.github.jackwener.dsh.core.provider

import org.junit.Assert.*
import org.junit.Test

class ProviderRuntimeTest {
    private val native = ProviderConfig("deepseek", "deepseek", "DeepSeek", "https://api.deepseek.com/v1", listOf("deepseek-flash"))
    private val cloud = ProviderConfig("kimi", "kimi", "Kimi", "https://example.com/v1", listOf("m"))
    private val local = ProviderConfig("local", "ollama", "Local", "http://192.168.1.2:11434/v1", listOf("m"))

    @Test fun allAdaptersValidateActualCredentials() {
        listOf(native to native.models.first(), cloud to "m").forEach { (p, m) ->
            val choice = ModelChoice(p, m)
            assertEquals(ModelConfigProblem.KeyMissing, choice.validate { null })
            assertNull(choice.validate { if (it == p.secretName) "test-key" else null })
            assertEquals(ModelConfigProblem.KeyMissing, choice.validate { " " })
        }
        assertNull(ModelChoice(local, "m").validate { null })
        // A gateway that used to have a key must not silently become unauthenticated after key loss.
        assertEquals(ModelConfigProblem.KeyMissing, ModelChoice(local.copy(hasKey = true), "m").validate { null })
    }

    @Test fun invalidSelectionIsRejectedBeforeReadingSecrets() {
        val choices = listOf(
            ModelChoice(null, "m", "removed") to ModelConfigProblem.ProviderMissing,
            ModelChoice(cloud.copy(enabled = false), "m") to ModelConfigProblem.ProviderDisabled,
            ModelChoice(cloud, "gone") to ModelConfigProblem.ModelMissing,
            ModelChoice(cloud.copy(baseUrl = "https://"), "m") to ModelConfigProblem.InvalidUrl,
        )
        choices.forEach { (c, problem) -> assertEquals(problem, c.validate { error("must not read a secret") }) }
    }

    @Test fun urlValidationAcceptsLanAndRejectsMalformedEndpoints() {
        listOf("https://example.com/v1/", "http://192.168.1.2:1234/v1", "http://localhost:8080").forEach { assertTrue(it, isProviderUrl(it)) }
        listOf("https://", "not a url", "file:///etc", "https://user:pass@example.com", "https://example.com?key=x", "https://example.com#x").forEach { assertFalse(it, isProviderUrl(it)) }
    }

    @Test fun deepSeekUsesTheSameAdapterAsEveryProvider() {
        val patch = renderProfilePatch(listOf(native, cloud), false)
        assertTrue(patch.contains("\"deepseek\""))
        assertTrue(patch.contains("\"kimi\""))
        assertEquals("DSH_ANDROID_KEY_DEEPSEEK", native.keyEnv)
        assertEquals("provider-deepseek", native.secretName)
    }

    @Test fun rotationOfEitherAdaptersKeyChangesFingerprint() {
        val providers = listOf(native, cloud)
        val keys = mapOf(native.secretName to "native-key", cloud.secretName to "cloud-key")
        fun fingerprint(slots: Map<String, String>) = providerFingerprint(renderProfilePatch(providers, true), providerEnvironment(providers, slots::get))
        val initial = fingerprint(keys)
        assertNotEquals(initial, fingerprint(keys + (native.secretName to "rotated-native-key")))
        assertNotEquals(initial, fingerprint(keys + (cloud.secretName to "rotated-cloud-key")))
        assertEquals(initial, fingerprint(keys.entries.reversed().associate { it.toPair() }))
        assertFalse(initial.contains("key"))
        assertEquals(mapOf("DSH_ANDROID_KEY_DEEPSEEK" to "native-key", "DSH_ANDROID_KEY_KIMI" to "cloud-key"), providerEnvironment(providers, keys::get))
        assertTrue(providerEnvironment(providers.map { it.copy(enabled = false) }, keys::get).isEmpty())
    }
}
