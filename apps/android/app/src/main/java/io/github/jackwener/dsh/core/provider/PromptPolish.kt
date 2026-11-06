package io.github.jackwener.dsh.core.provider

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import java.net.HttpURLConnection
import java.net.URL

/** One text-only request: no conversation history, tools, model fallback or agent execution. */
object PromptPolish {
    const val MAX_INPUT = 8_000
    const val MAX_OUTPUT = 12_000

    fun body(model: String, draft: String, instructions: String, protocol: ProviderProtocol,
             reasoning: ModelReasoning? = null, cap: Int = 2048): String = buildJsonObject {
        put("model", model)
        put("stream", false)
        when (protocol) {
            ProviderProtocol.Responses -> {
                put("instructions", instructions)
                put("input", draft)
                put("max_output_tokens", cap)
            }
            else -> {
                if (protocol == ProviderProtocol.Messages) put("system", instructions)
                putJsonArray("messages") {
                    if (protocol == ProviderProtocol.ChatCompletions) addJsonObject {
                        put("role", "system"); put("content", instructions)
                    }
                    addJsonObject { put("role", "user"); put("content", draft) }
                }
                val name = model.substringAfterLast('/').lowercase()
                val completionCap = listOf("gpt-5", "o1", "o3", "o4").any { name.startsWith(it) }
                put(if (protocol == ProviderProtocol.ChatCompletions && completionCap) "max_completion_tokens" else "max_tokens", cap)
            }
        }
        // Only declared wire controls are safe across arbitrary compatible gateways.
        when (reasoning?.decl?.control) {
            ReasoningControl.EnableThinking -> if (protocol == ProviderProtocol.ChatCompletions) put("enable_thinking", false)
            ReasoningControl.ThinkingType -> if (protocol != ProviderProtocol.Responses) putJsonObject("thinking") { put("type", "disabled") }
            ReasoningControl.Effort -> reasoning.levels.firstOrNull { it.id in listOf("minimal", "low") }?.let {
                if (protocol == ProviderProtocol.Responses) putJsonObject("reasoning") { put("effort", it.id) }
                else if (protocol == ProviderProtocol.ChatCompletions) put("reasoning_effort", it.id)
            }
            else -> Unit
        }
    }.toString()

    fun answer(payload: String, protocol: ProviderProtocol): String {
        val root = Json.parseToJsonElement(payload).jsonObject
        require(root["error"] == null || root["error"] is JsonNull) { "Invalid response" }
        val text = when (protocol) {
            ProviderProtocol.ChatCompletions -> {
                val choice = root["choices"]?.jsonArray?.firstOrNull()?.jsonObject ?: error("Empty response")
                require(choice["finish_reason"]?.jsonPrimitive?.content in listOf("stop", "end_turn")) { "Incomplete response" }
                choice["message"]?.jsonObject?.get("content")?.jsonPrimitive?.content.orEmpty()
            }
            ProviderProtocol.Messages -> {
                require(root["stop_reason"]?.jsonPrimitive?.content == "end_turn") { "Incomplete response" }
                textBlocks(root["content"])
            }
            ProviderProtocol.Responses -> {
                require(root["status"]?.jsonPrimitive?.content == "completed") { "Incomplete response" }
                root["output"]?.jsonArray.orEmpty().joinToString("") { item ->
                    val o = item.jsonObject
                    if (o["type"]?.jsonPrimitive?.content == "message") textBlocks(o["content"]) else ""
                }
            }
        }.trim()
        require(text.isNotBlank() && text.length <= MAX_OUTPUT) { "Empty or oversized response" }
        return text
    }

    private fun textBlocks(value: JsonElement?): String = (value as? JsonArray).orEmpty().joinToString("") {
        val o = it.jsonObject
        if (o["type"]?.jsonPrimitive?.content in listOf("text", "output_text")) o["text"]?.jsonPrimitive?.content.orEmpty() else ""
    }

    /** Keep literal links, file/skill references, commands, inline code and fenced code intact. */
    fun preservesReferences(before: String, after: String): Boolean =
        Regex("```[\\s\\S]*?```|`[^`\\n]+`|https?://[^\\s<>]+|[A-Za-z]:[\\\\/][^\\s\"<>]+|(?<!\\S)@[^\\s]+|(?<!\\S)/[^\\s]+")
            .findAll(before).all { it.value in after }

    suspend fun request(choice: ModelChoice, instructions: String, draft: String, reasoning: ModelReasoning?,
                        readSecret: (String) -> String?): String = withContext(Dispatchers.IO) {
        require(draft.isNotBlank() && draft.length <= MAX_INPUT)
        require(choice.validate(readSecret) == null)
        val p = requireNotNull(choice.provider)
        val connection = URL(p.baseUrl.trim().trimEnd('/') + p.protocol.path).openConnection() as HttpURLConnection
        // Cancelling the composer also interrupts blocking network IO rather than just ignoring its result.
        val closer = Job(currentCoroutineContext()[Job])
        val cancellation = closer.invokeOnCompletion { connection.disconnect() }
        try {
            connection.connectTimeout = 5_000
            connection.readTimeout = 15_000
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            val extra = appRequestHeaders(resolveHeaderRows(headerRowsOf(p), p, readSecret), p.sessionHeader,
                appUserAgent(io.github.jackwener.dsh.BuildConfig.VERSION_NAME))
            p.protocol.requestHeaders(readSecret(p.secretName), extra).forEach { (k, v) -> connection.setRequestProperty(k, v) }
            val cap = minOf(2048, p.limitsOf(choice.model).maxTokens).coerceAtLeast(1)
            connection.outputStream.use { it.write(body(choice.model, draft, instructions, p.protocol, reasoning, cap).toByteArray(Charsets.UTF_8)) }
            check(connection.responseCode in 200..299) { "HTTP ${connection.responseCode}" }
            val payload = connection.inputStream.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    currentCoroutineContext().ensureActive()
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(out.size() + count <= 131_072) { "Oversized response" }
                    out.write(buffer, 0, count)
                }
                out.toString("UTF-8")
            }
            currentCoroutineContext().ensureActive()
            answer(payload, p.protocol).also { require(preservesReferences(draft, it)) { "Changed references" } }
        } finally {
            cancellation.dispose()
            closer.complete()
            connection.disconnect()
        }
    }
}
