package io.github.jackwener.dsh.feature.learning

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.MessageDigest

sealed interface RichPart {
    data class Markdown(val text: String) : RichPart
    data class Artifact(val payload: JsonObject, val fingerprint: String) : RichPart
}

/** Only complete, top-level, explicitly marked blocks become interactive content. */
object RichContent {
    private val opening = Regex("^ {0,3}(`{3,}|~{3,})([^\\r\\n]*)$")
    private val supported = setOf("dsh-visual", "mermaid", "math", "dsh-html")
    private val types = setOf("function", "diagram", "chart", "quiz", "math", "table", "code", "html")
    private val json = Json { ignoreUnknownKeys = true }

    fun parse(text: String): List<RichPart> {
        val lines = text.splitToSequence('\n').toList()
        val result = mutableListOf<RichPart>()
        val pending = StringBuilder()
        fun plain(line: String, index: Int) { pending.append(line); if (index < lines.lastIndex) pending.append('\n') }
        fun flush() { if (pending.isNotEmpty()) { result += RichPart.Markdown(pending.toString()); pending.clear() } }
        var i = 0
        while (i < lines.size) {
            val match = opening.matchEntire(lines[i].trimEnd('\r'))
            if (match == null) { plain(lines[i], i); i++; continue }
            val marker = match.groupValues[1]
            val language = match.groupValues[2].trim().lowercase().substringBefore(' ')
            val end = (i + 1 until lines.size).firstOrNull { n ->
                val closing = lines[n].trimEnd('\r').trimStart(' ')
                lines[n].length - lines[n].trimStart(' ').length <= 3 &&
                    closing.trimEnd().length >= marker.length && closing.trimEnd().all { it == marker[0] }
            }
            if (end == null) { for (n in i until lines.size) plain(lines[n], n); break }
            val body = lines.subList(i + 1, end).joinToString("\n").trimEnd('\r')
            val payload = if (language in supported && body.length <= 150_000) runCatching {
                when (language) {
                    "dsh-visual" -> (json.parseToJsonElement(body) as? JsonObject)?.takeIf { it["type"]?.jsonPrimitive?.content in types }
                    "mermaid" -> buildJsonObject { put("type", "diagram"); put("source", body) }
                    "math" -> buildJsonObject { put("type", "math"); put("latex", body) }
                    "dsh-html" -> buildJsonObject { put("type", "html"); put("html", body) }
                    else -> null
                }
            }.getOrNull() else null
            if (payload == null) for (n in i..end) plain(lines[n], n)
            else { flush(); result += RichPart.Artifact(payload, fingerprint(payload.toString())) }
            i = end + 1
        }
        flush()
        return result
    }

    fun fingerprint(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8)).take(16).joinToString("") { "%02x".format(it) }
}
