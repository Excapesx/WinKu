package io.github.jackwener.dsh.feature.preview

import io.github.jackwener.dsh.core.session.Projector
import io.github.jackwener.dsh.core.session.TurnStatus
import io.github.jackwener.dsh.feature.learning.RichContent
import io.github.jackwener.dsh.feature.learning.RichPart
import org.junit.Assert.*
import org.junit.Test

class AppPreviewDataTest {
    @Test fun fixtureUsesRealConversationProjectionAndCompletedRichContent() {
        val events = AppPreviewData.turnEvents("给我讲解一下函数极限", AppPreviewData.limitsReply, 1, 1, 1_000)
        val conversation = Projector.conversation(events, false)
        assertEquals(1, conversation.turns.size)
        assertEquals(TurnStatus.Completed, conversation.turns.single().status)
        assertEquals("给我讲解一下函数极限", conversation.turns.single().user?.text)
        assertTrue(RichContent.parse(AppPreviewData.limitsReply).any { it is RichPart.Artifact })
        assertTrue(events.zipWithNext().all { (a, b) -> a.seq < b.seq && a.time < b.time })
    }
}
