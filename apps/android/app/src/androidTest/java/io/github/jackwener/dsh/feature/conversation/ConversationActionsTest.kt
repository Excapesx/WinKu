package io.github.jackwener.dsh.feature.conversation

import android.content.Intent
import android.graphics.Rect
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.lifecycle.ViewModelProvider
import androidx.test.platform.app.InstrumentationRegistry
import io.github.jackwener.dsh.BuildConfig
import io.github.jackwener.dsh.MainActivity
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.session.APP_PROMPT_PREFIX
import io.github.jackwener.dsh.core.session.Block
import io.github.jackwener.dsh.core.session.USER_REGENERATE
import io.github.jackwener.dsh.core.session.textOf
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Real activity, navigation, touch controls, streaming projection and durable history in the isolated app. */
class ConversationActionsTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun waitFor(condition: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 20_000
        while (SystemClock.uptimeMillis() < until) { if (condition()) return; Thread.sleep(40) }
        fail("Timed out waiting for conversation action")
    }
    private fun find(label: String): AccessibilityNodeInfo? {
        fun walk(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (node.text?.toString() == label || node.contentDescription?.toString() == label) return node
            for (index in 0 until node.childCount) node.getChild(index)?.let { walk(it)?.let { found -> return found } }
            return null
        }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::walk)
    }
    private fun click(label: String) {
        waitFor { find(label) != null }
        var node = find(label)!!
        while (!node.isClickable && node.parent != null) node = node.parent
        assertTrue("Clickable: $label", node.performAction(AccessibilityNodeInfo.ACTION_CLICK))
    }
    private fun screenshot(name: String) {
        if (InstrumentationRegistry.getArguments().getString("screenshots") != "true") return
        Thread.sleep(350)
        instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
            java.io.File(context.externalCacheDir, "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }
    private fun launch(): MainActivity {
        assumeTrue(BuildConfig.LEARNING_PREVIEW)
        return instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
    }

    @Test fun regenerateReplacesTheAnswerWithoutRepeatingTheQuestionAndRejectsDoubleTap() {
        val activity = launch()
        lateinit var vm: HomeViewModel
        instrumentation.runOnMainSync { vm = ViewModelProvider(activity)[HomeViewModel::class.java] }
        try {
            waitFor { vm.live.value.sessionId.isNotEmpty() }
            instrumentation.runOnMainSync { vm.newSession(null) }
            waitFor { vm.live.value.sessionId == vm.id }
            val question = "用一个例子解释函数极限"
            instrumentation.runOnMainSync { vm.send(question) }
            waitFor { !vm.live.value.running && vm.conversation.value.turns.lastOrNull()?.reply != null }
            val original = vm.conversation.value.turns.single()
            screenshot("regenerate-before")
            click(context.getString(R.string.regenerate_reply))
            waitFor { vm.live.value.events.any { it.data["kind"]?.jsonPrimitive?.content == USER_REGENERATE } }
            // The UI hides the control during generation; an already queued duplicate callback is rejected too.
            instrumentation.runOnMainSync { vm.regenerate(original.key) }
            var sawLiveReplacement = false
            waitFor {
                val live = vm.live.value
                if (live.assistantStream?.blocks?.any { it is Block.Text } == true) {
                    sawLiveReplacement = true
                    val text = vm.conversation.value.turns.single().blocks.filterIsInstance<Block.Text>()
                    assertFalse("Old answer is replaced, not appended", text.any { it.text == original.reply!!.text })
                }
                !live.running && vm.conversation.value.turns.lastOrNull()?.reply?.text?.contains("重新生成的本地示例回复") == true
            }
            assertTrue("Replacement streams through the real chat projector", sawLiveReplacement)
            val live = vm.live.value
            assertEquals(1, live.events.count { it.data["kind"]?.jsonPrimitive?.content == USER_REGENERATE })
            assertEquals(1, live.events.count { it.type == "user/message" && !textOf(it.data["content"]).startsWith(APP_PROMPT_PREFIX) })
            assertEquals(2, live.events.count { it.type == "assistant/message" })
            assertEquals(question, vm.conversation.value.turns.single().user!!.text)
            waitFor { find(context.getString(R.string.regenerate_reply)) != null }
            screenshot("regenerate-after")
            // Stopping a replacement before settlement keeps the last durable answer available.
            val durable = vm.conversation.value.turns.single().reply!!.text
            click(context.getString(R.string.regenerate_reply))
            waitFor { vm.live.value.running && vm.live.value.assistantStream?.blocks?.any { it is Block.Text } == true }
            instrumentation.runOnMainSync { vm.stop() }
            waitFor { !vm.live.value.running && vm.conversation.value.turns.single().reply != null }
            Thread.sleep(250)
            assertEquals(durable, vm.conversation.value.turns.single().reply!!.text)
            assertEquals("Stopped generation is not committed as a second answer", 2, vm.live.value.events.count { it.type == "assistant/message" })
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }

    @Test fun toolsEntryMatchesTheSidebarAndBackReturnsToTheSameConversation() {
        val activity = launch()
        lateinit var vm: HomeViewModel
        instrumentation.runOnMainSync { vm = ViewModelProvider(activity)[HomeViewModel::class.java] }
        try {
            waitFor { vm.live.value.sessionId.isNotEmpty() }
            val session = vm.id
            click(context.getString(R.string.open_sidebar))
            val label = context.getString(R.string.tools_title)
            waitFor { find(label) != null && find(context.getString(R.string.automation)) != null }
            val tools = Rect().also { find(label)!!.getBoundsInScreen(it) }
            val automation = Rect().also { find(context.getString(R.string.automation))!!.getBoundsInScreen(it) }
            assertEquals("Same label alignment", automation.left, tools.left)
            assertTrue("Tools is above automations", tools.bottom <= automation.top)
            screenshot("tools-drawer")
            click(label)
            waitFor { find(context.getString(R.string.tools_empty_title)) != null }
            screenshot("tools-page")
            click(context.getString(R.string.back))
            waitFor { find(context.getString(R.string.open_sidebar)) != null }
            assertEquals("Navigation preserves the conversation", session, vm.id)
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
}
