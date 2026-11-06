package io.github.jackwener.dsh.feature.conversation

import android.content.Intent
import android.os.SystemClock
import androidx.lifecycle.ViewModelProvider
import androidx.test.platform.app.InstrumentationRegistry
import io.github.jackwener.dsh.BuildConfig
import io.github.jackwener.dsh.MainActivity
import io.github.jackwener.dsh.core.session.Block
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Actual activity, SessionStore and chat projection; isolated preview only, no API key required. */
class StreamingOutputTest {
    @Test fun liveTextReachesTheChatBeforeTheDurableMessageAndSettlesOnce() {
        assumeTrue(BuildConfig.LEARNING_PREVIEW)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
        instrumentation.waitForIdleSync()
        lateinit var vm: HomeViewModel
        instrumentation.runOnMainSync { vm = ViewModelProvider(activity)[HomeViewModel::class.java] }
        // Let first-run preview seeding and navigation finish before starting a separate conversation.
        val ready = SystemClock.uptimeMillis() + 15_000
        while (vm.live.value.sessionId.isEmpty() && SystemClock.uptimeMillis() < ready) Thread.sleep(20)
        instrumentation.runOnMainSync { vm.newSession(null) }
        val prompt = "流式验证：中文与 emoji 👩‍💻。".repeat(10)
        instrumentation.runOnMainSync { vm.send(prompt) }
        val until = SystemClock.uptimeMillis() + 15_000
        val lengths = mutableSetOf<Int>()
        var observedBeforeHistory = false
        while (SystemClock.uptimeMillis() < until) {
            val live = vm.live.value
            val text = vm.conversation.value.turns.lastOrNull()?.blocks?.filterIsInstance<Block.Text>()?.lastOrNull()?.text.orEmpty()
            if (live.running && live.assistantStream != null && text.isNotEmpty()) {
                lengths += text.length
                if (live.events.none { it.type == "assistant/message" }) observedBeforeHistory = true
            }
            if (observedBeforeHistory && !live.running) break
            Thread.sleep(10)
        }
        assertTrue("Text is visible before assistant/message is committed", observedBeforeHistory)
        assertTrue("More than one progressive text snapshot", lengths.size >= 3)
        val live = vm.live.value
        assertFalse("Stream finishes", live.running)
        assertNull(live.assistantStream)
        assertEquals("Only the durable final message is recorded", 1, live.events.count { it.type == "assistant/message" })
        val deadline = SystemClock.uptimeMillis() + 3000
        while (vm.conversation.value.turns.lastOrNull()?.reply == null && SystemClock.uptimeMillis() < deadline) Thread.sleep(10)
        val blocks = vm.conversation.value.turns.last().blocks.filterIsInstance<Block.Text>()
        assertEquals("No duplicate transient message", 1, blocks.size)
        assertTrue(blocks.single().text.contains("👩‍💻"))
        instrumentation.runOnMainSync { activity.finish() }
    }
}
