package io.github.jackwener.dsh.core.session

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

/** In-memory display state, never persisted or counted as model usage. */
data class AssistantStream(val attemptId: String, val turn: Int, val step: Int, val startedAt: Long, val blocks: List<Block>)

/** Generation/revision watermarks reject queued updates from an old engine or attempt. */
internal fun SessionLive.withAssistantStream(data: JsonObject, generation: Int): SessionLive {
    fun str(name: String) = (data[name] as? JsonPrimitive)?.contentOrNull
    fun number(name: String) = (data[name] as? JsonPrimitive)?.longOrNull
    val revision = number("revision") ?: return this
    if (generation < assistantStreamGeneration || generation == assistantStreamGeneration && revision <= assistantStreamRevision) return this
    val attempt = str("attemptId") ?: return this
    val phase = str("phase")
    if (phase != "streaming" && phase != "end") return this
    val stream = if (phase == "end") null else {
        val turn = (data["turn"] as? JsonPrimitive)?.intOrNull ?: return this
        val step = (data["step"] as? JsonPrimitive)?.intOrNull ?: return this
        val blocks = (data["blocks"] as? JsonArray).orEmpty().mapNotNull { element ->
            val block = element as? JsonObject ?: return@mapNotNull null
            val index = (block["index"] as? JsonPrimitive)?.intOrNull ?: return@mapNotNull null
            val text = (block["text"] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            val key = "live/$attempt/$index"
            when ((block["type"] as? JsonPrimitive)?.contentOrNull) {
                "text" -> Block.Text(key, text, interrupted = false)
                "reasoning" -> Block.Reasoning(key, text)
                else -> null
            }
        }
        AssistantStream(attempt, turn, step, number("startedAt") ?: 0, blocks)
    }
    return copy(assistantStream = stream, assistantStreamGeneration = generation, assistantStreamRevision = revision)
}

/** Overlay on a cached durable projection; no log replay per token. */
fun Conversation.withAssistantStream(stream: AssistantStream?): Conversation {
    if (stream == null || stream.blocks.isEmpty()) return this
    val turn = turns.lastOrNull()?.takeIf { it.status == TurnStatus.Running && (it.number == null || it.number == stream.turn) } ?: return this
    val replacing = turn.regenerating && stream.blocks.any { it is Block.Text }
    val previousAnswer = if (replacing) turn.blocks.indexOfLast { it is Block.Text } else -1
    val previous = turn.blocks.filterIndexed { index, _ -> index != previousAnswer }
    return copy(turns = turns.dropLast(1) + turn.copy(blocks = previous + stream.blocks))
}

/** The journal changes once per event, whereas transient display snapshots can arrive every frame. */
internal class LiveConversationProjector {
    private var sessionId: String? = null
    private var events: List<LoggedEvent>? = null
    private var running = false
    private var durable = Conversation()

    fun project(live: SessionLive): Conversation {
        if (sessionId != live.sessionId || events !== live.events || running != live.running) {
            sessionId = live.sessionId; events = live.events; running = live.running
            durable = Projector.conversation(live.events, live.running)
        }
        return durable.withAssistantStream(live.assistantStream)
    }
}
