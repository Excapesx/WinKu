package io.github.jackwener.dsh.core.session

import io.github.jackwener.dsh.core.engine.RpcJson
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.*
import org.junit.Test

class RegenerationTest {
    private fun ev(seq: Long, type: String, json: String) = LoggedEvent(seq, type, seq * 1000, RpcJson.parseToJsonElement(json) as JsonObject)
    private val original = listOf(
        ev(0, "turn/start", """{"turn":1}"""),
        ev(1, "user/message", """{"source":{"kind":"user"},"content":[{"type":"text","text":"解释这道题"},{"type":"image","attachment":{"id":"photo"}}]}"""),
        ev(2, "assistant/message", """{"message":{"content":[{"type":"text","text":"原回答"}]},"usage":{"inputTokens":10,"outputTokens":20}}"""),
        ev(3, "turn/end", """{"turn":1,"reason":{"kind":"completed"}}"""),
    )
    private val retry = listOf(
        ev(4, "app/notice", """{"kind":"$USER_REGENERATE"}"""),
        ev(5, "turn/start", """{"turn":2}"""),
        ev(6, "user/message", """{"source":{"kind":"user"},"content":[{"type":"text","text":${JsonPrimitive(REGENERATE_REPLY)}}]}"""),
    )

    @Test fun `replaces the answer in place and preserves question image and usage across reload`() {
        val events = original + retry + listOf(
            ev(7, "assistant/message", """{"message":{"content":[{"type":"text","text":"新回答"}]},"usage":{"inputTokens":30,"outputTokens":40}}"""),
            ev(8, "turn/end", """{"turn":2,"reason":{"kind":"completed"}}"""),
        )
        val conv = Projector.conversation(events, false)
        val turn = conv.turns.single()
        assertEquals("t0", turn.key)
        assertEquals("解释这道题", turn.user!!.text)
        assertEquals(1, turn.user.images)
        assertEquals("新回答", turn.reply!!.text)
        assertEquals(1, turn.blocks.filterIsInstance<Block.Text>().size)
        assertEquals(100L, conv.usage.total)
        assertEquals(100L, turn.usage.total)
        assertEquals(2, events.count { it.type == "assistant/message" })
        assertTrue(turn.canRegenerate(SessionLive("s")))
    }

    @Test fun `preserves old answer on a failed request and replaces it only when new text arrives`() {
        val waiting = Projector.conversation(original + retry, true)
        assertEquals("原回答", (waiting.turns.single().blocks.last() as Block.Text).text)
        val stream = AssistantStream("a", 2, 1, 9000, listOf(Block.Text("live", "新", false)))
        val visible = waiting.withAssistantStream(stream).turns.single().blocks.filterIsInstance<Block.Text>()
        assertEquals(listOf("新"), visible.map { it.text })
        val failed = Projector.conversation(original + retry + ev(7, "app/error", """{"kind":"engine","message":"offline"}"""), false)
        assertEquals("原回答", failed.turns.single().reply!!.text)
        assertEquals(TurnStatus.Failed, failed.turns.single().status)
    }

    @Test fun `works when the prompt precedes turn start and after multiple regenerations`() {
        val first = original + listOf(retry[0], retry[2], retry[1]) + listOf(
            ev(7, "assistant/message", """{"message":{"content":[{"type":"text","text":"第二版"}]}}"""),
            ev(8, "turn/end", """{"turn":2,"reason":{"kind":"completed"}}"""),
        )
        val second = first + listOf(
            ev(9, "app/notice", """{"kind":"$USER_REGENERATE"}"""),
            ev(10, "turn/start", """{"turn":3}"""),
            ev(11, "user/message", """{"source":{"kind":"user"},"content":[{"type":"text","text":${JsonPrimitive(REGENERATE_REPLY)}}]}"""),
            ev(12, "assistant/message", """{"message":{"content":[{"type":"reasoning","text":"检查"}]}}"""),
            ev(13, "assistant/message", """{"message":{"content":[{"type":"text","text":"第三版"}]}}"""),
            ev(14, "turn/end", """{"turn":3,"reason":{"kind":"completed"}}"""),
        )
        val turn = Projector.conversation(second, false).turns.single()
        assertEquals("第三版", turn.reply!!.text)
        assertEquals(listOf("第三版"), turn.blocks.filterIsInstance<Block.Text>().map { it.text })
    }

    @Test fun `cannot regenerate while busy queued or without an original question`() {
        val turn = Projector.conversation(original, false).turns.single()
        assertFalse(turn.canRegenerate(SessionLive("s", running = true)))
        assertFalse(turn.canRegenerate(SessionLive("s", queue = listOf(QueuedMessage("q", "next")))))
        assertFalse(turn.copy(user = null).canRegenerate(SessionLive("s")))
    }
}
