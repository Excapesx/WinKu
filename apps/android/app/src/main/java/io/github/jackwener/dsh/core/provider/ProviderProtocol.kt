package io.github.jackwener.dsh.core.provider

import kotlinx.serialization.Serializable

@Serializable
enum class ProviderProtocol(val wire: String, val path: String, val label: String) {
    ChatCompletions("openai-chat-completions", "/chat/completions", "Chat Completions"),
    Responses("openai-responses", "/responses", "Responses"),
    Messages("anthropic-messages", "/messages", "Messages");

    fun authHeaders(key: String?): Map<String, String> = buildMap {
        if (this@ProviderProtocol == Messages) {
            put("anthropic-version", "2023-06-01")
            if (!key.isNullOrBlank()) put("x-api-key", key.trim())
        } else if (!key.isNullOrBlank()) put("Authorization", "Bearer ${key.trim()}")
    }

    fun requestHeaders(key: String?, extra: Map<String, String>): Map<String, String> = buildMap {
        putAll(authHeaders(key))
        val credential = if (this@ProviderProtocol == Messages) "x-api-key" else "authorization"
        extra.forEach { (name, value) ->
            if (key.isNullOrBlank() || !name.equals(credential, true)) put(name, value)
        }
    }
}
