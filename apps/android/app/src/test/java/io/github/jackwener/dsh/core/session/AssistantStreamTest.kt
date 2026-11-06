package io.github.jackwener.dsh.core.session

import io.github.jackwener.dsh.core.engine.RpcJson
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.*
import org.junit.Test

class AssistantStreamTest {
    private fun payload(revision: Int, text: String = "你好🙂", phase: String = "streaming", attempt: String = "a") =
        RpcJson.parseToJsonElement("""{"attemptId":"$attempt","revision":$revision,"turn":1,"step":1,"startedAt":100,"phase":"$phase","blocks":[{"index":0,"type":"text","text":"$text"}]}""") as JsonObject
    private fun event(seq: Long, type: String, data: String) = LoggedEvent(seq, type, seq, RpcJson.parseToJsonElement(data) as JsonObject)
    private val events = listOf(event(1, "turn/start", """{"turn":1}"""), event(2, "user/message", """{"content":[{"type":"text","text":"hi"}]}"""))

    @Test fun `transient text appears before settlement without changing history or usage`() {
        val live = SessionLive("s", events = events, running = true).withAssistantStream(payload(2), 1)
        val conversation = LiveConversationProjector().project(live)
        assertEquals("你好🙂", (conversation.turns.single().blocks.last() as Block.Text).text)
        assertSame(events, live.events)
        assertEquals(Usage(), conversation.usage)
    }

    @Test fun `old revisions and old engine generations cannot replace current text`() {
        val state = SessionLive("s").withAssistantStream(payload(10), 2)
        assertSame(state, state.withAssistantStream(payload(9, "old"), 2))
        assertSame(state, state.withAssistantStream(payload(100, "old"), 1))
        assertEquals("new", (state.withAssistantStream(payload(1, "new"), 3).assistantStream!!.blocks.single() as Block.Text).text)
    }

    @Test fun `durable settlement replaces transient text exactly once`() {
        val live = SessionLive("s", events = events, running = true).withAssistantStream(payload(2), 1)
        val message = event(3, "assistant/message", """{"message":{"content":[{"type":"text","text":"你好🙂 完成"}]}}""")
        val settled = live.copy(events = events + message).withLogged(message)
        assertNull(settled.assistantStream)
        val blocks = LiveConversationProjector().project(settled).turns.single().blocks.filterIsInstance<Block.Text>()
        assertEquals(listOf("你好🙂 完成"), blocks.map { it.text })
        assertNull(settled.withAssistantStream(payload(3, phase = "end"), 1).assistantStream)
    }

    @Test fun `stop end and next turn clear unfinished output`() {
        val live = SessionLive("s").withAssistantStream(payload(2), 1)
        assertNull(live.idle().assistantStream)
        assertNull(live.withLogged(event(9, "turn/start", "{}" )).assistantStream)
        assertNull(live.withLogged(event(9, "assistant/attempt", "{}" )).assistantStream)
        assertNull(live.withAssistantStream(payload(3, phase = "end"), 1).assistantStream)
    }

    @Test fun `stream from another turn is never overlaid on history`() {
        val complete = events + event(3, "turn/end", """{"reason":{"kind":"completed"}}""")
        val conversation = Projector.conversation(complete, false)
        val stream = SessionLive("s").withAssistantStream(payload(2), 1).assistantStream
        assertSame(conversation, conversation.withAssistantStream(stream))
    }

    @Test fun `incremental snapshots reuse the durable projection and session switches reset it`() {
        val projector = LiveConversationProjector()
        val live = SessionLive("s", events = events, running = true)
        val base = projector.project(live)
        projector.project(live.withAssistantStream(payload(2), 1))
        assertSame(base, projector.project(live))
        assertTrue(projector.project(SessionLive("other")).isEmpty)
    }
}
