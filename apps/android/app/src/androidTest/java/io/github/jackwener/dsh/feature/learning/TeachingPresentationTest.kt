package io.github.jackwener.dsh.feature.learning

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import io.github.jackwener.dsh.core.data.ThemeMode
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshTheme
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class TeachingPresentationTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun js(web: WebView, source: String): String {
        val latch = CountDownLatch(1); var result = "null"
        instrumentation.runOnMainSync { web.evaluateJavascript(source) { result = it; latch.countDown() } }
        assertTrue("WebView callback", latch.await(5, TimeUnit.SECONDS))
        return result
    }
    private fun waitFor(condition: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 30_000
        while (SystemClock.uptimeMillis() < until) { if (condition()) return; Thread.sleep(80) }
        fail("Timed out waiting for the actual packaged presentation")
    }
    private fun screenshot(name: String) {
        if (InstrumentationRegistry.getArguments().getString("screenshots") != "true") return
        instrumentation.waitForIdleSync(); Thread.sleep(350)
        instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
            java.io.File(instrumentation.targetContext.externalCacheDir, "$name.png").outputStream().use {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            bitmap.recycle()
        }
    }
    @Test fun codeHighlightsCopiesWrapsAndKeepsItsViewDuringStreaming() {
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as ComponentActivity
        val original = """
            int* p = new int(10);
            auto q = std::make_unique<Widget>("中文 👩‍💻", 1, 2, 3); // 创建对象并转移所有权，长行保持可读
            // auto other = q; // 不能拷贝
            auto moved = std::move(q);
        """.trimIndent()
        val text = mutableStateOf("## unique_ptr：默认选择\n\n" + "\u0060\u0060\u0060cpp\n" + original)
        val mode = mutableStateOf(ThemeMode.Dark)
        instrumentation.runOnMainSync { activity.setContent { DshTheme(mode.value) {
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp)) {
                LearningMarkdown(text.value, "code-presentation", {})
            }
        } } }
        try {
            var web: WebView? = null
            waitFor {
                instrumentation.runOnMainSync { web = findWeb(activity.window.decorView) }
                web != null && js(web!!, "document.querySelectorAll('.code-block .hljs-keyword').length>0 && !!document.querySelector('[data-code-action=copy]')") == "true"
            }
            val first = web!!
            assertEquals("Canonical C++ language label", "\"C++\"", js(first, "document.querySelector('.code-language').textContent"))
            assertEquals("Distinct token colors", "true", js(first, "new Set(['.hljs-keyword','.hljs-number','.hljs-comment'].map(s=>getComputedStyle(document.querySelector(s)).color)).size===3"))
            assertEquals("Long source can be horizontally scrolled", "true", js(first, "(()=>{const p=document.querySelector('.code-block pre');return p.scrollWidth>p.clientWidth})()"))
            screenshot("code-dark")
            instrumentation.runOnMainSync { mode.value = ThemeMode.Light }
            waitFor { js(first, "document.documentElement.dataset.theme==='light'") == "true" }
            screenshot("code-light")
            instrumentation.runOnMainSync { mode.value = ThemeMode.Dark }
            waitFor { js(first, "document.documentElement.dataset.theme==='dark'") == "true" }
            js(first, "document.querySelector('[data-code-action=copy]').click()")
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            waitFor {
                var copied = ""
                instrumentation.runOnMainSync { copied = clipboard.primaryClip?.getItemAt(0)?.text?.toString().orEmpty() }
                copied == original
            }
            assertEquals("Copy feedback is visible", "true", js(first, "document.querySelector('[data-code-action=copy]').dataset.copied==='true'"))
            js(first, "document.querySelector('[data-code-action=wrap]').click()")
            waitFor { js(first, "getComputedStyle(document.querySelector('.code-block pre')).whiteSpace==='pre-wrap'") == "true" }
            val extended = original + "\n// 新到达的增量"
            instrumentation.runOnMainSync { text.value = "## unique_ptr：默认选择\n\n\u0060\u0060\u0060cpp\n$extended\n\u0060\u0060\u0060" }
            waitFor { Json.parseToJsonElement(js(first, "document.querySelector('pre code').textContent")).jsonPrimitive.content == extended }
            assertEquals("Wrap setting survives streamed HTML replacement", "\"true\"", js(first, "document.querySelector('.code-block').dataset.wrap"))
            instrumentation.runOnMainSync { web = findWeb(activity.window.decorView) }
            assertSame("Streaming uses the same WebView", first, web)
            screenshot("code-dark-wrapped")
            instrumentation.runOnMainSync { mode.value = ThemeMode.Light }
            waitFor { js(first, "document.documentElement.dataset.theme==='light'") == "true" }
            assertEquals("Theme changes retain the wrapping preference", "true", js(first, "document.querySelector('.code-block').dataset.wrap==='true' && getComputedStyle(document.querySelector('.code-block pre')).whiteSpace==='pre-wrap'"))
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
    @Test fun allTeachingLayoutsFormulaBracesAndChemicalConditionsRenderInBothThemes() {
        val context = instrumentation.targetContext
        val examples = Json.parseToJsonElement(context.assets.open("learning/examples.json").bufferedReader().use { it.readText() }).jsonObject
        val activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as ComponentActivity
        val payload = mutableStateOf(examples["teaching-0"]!!.jsonObject)
        val mode = mutableStateOf(ThemeMode.Light)
        instrumentation.runOnMainSync { activity.setContent { DshTheme(mode.value) {
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp)) {
                LearningMarkdown("\u0060\u0060\u0060dsh-visual\n"+payload.value+"\n\u0060\u0060\u0060", "teaching-gallery", {})
            }
        } } }
        try {
            for (index in 0..6) {
                instrumentation.runOnMainSync { payload.value = examples[if(index==6) "code" else "teaching-$index"]!!.jsonObject; mode.value = ThemeMode.Light }
                instrumentation.waitForIdleSync()
                var web: WebView? = null
                val selector = if (index < 4) ".explanation-content" else if(index==6) ".code-view .hljs-keyword" else ".math-block .katex"
                waitFor {
                    instrumentation.runOnMainSync { web = findWeb(activity.window.decorView) }
                    web != null && js(web!!, "!!document.querySelector('$selector') && document.querySelector('.component-heading h2')?.textContent===${payload.value["title"]} && !document.querySelector('.math-error,.component-error') && document.fonts.status==='loaded'") == "true"
                }
                when (index) {
                    0 -> assertEquals("Four nodes and three labelled connectors", "true", js(web!!, "document.querySelectorAll('.explanation-item').length===4 && document.querySelectorAll('.explanation-connector').length===3"))
                    1 -> assertEquals("Highlighted code concepts", "2", js(web!!, "document.querySelectorAll('.explanation-focus code').length"))
                    2 -> assertEquals("Comparison panels", "2", js(web!!, "document.querySelectorAll('.explanation-compare .explanation-item').length"))
                    3 -> assertEquals("Learning facts and goals", "true", js(web!!, "document.querySelectorAll('.explanation-facts dd').length===3 && document.querySelectorAll('.explanation-points li').length===3"))
                    4 -> assertEquals("Three visible brace shapes", "true", js(web!!, "document.querySelectorAll('.katex .brace-left,.katex .brace-center,.katex .brace-right').length>=3 || document.querySelectorAll('.katex .stretchy').length>=3"))
                    5 -> assertEquals("Reaction condition is retained", "true", js(web!!, "document.querySelector('.katex-html').textContent.includes('点燃') && !!document.querySelector('.katex svg path')"))
                    6 -> assertEquals("Code artifacts use the same highlighted presentation", "\"Python\"", js(web!!, "document.querySelector('.code-language').textContent"))
                }
                screenshot("teaching-$index-light")
                instrumentation.runOnMainSync { mode.value = ThemeMode.Dark }
                waitFor { js(web!!, "document.documentElement.dataset.theme==='dark'") == "true" }
                screenshot("teaching-$index-dark")
            }
            instrumentation.runOnMainSync { payload.value = Json.parseToJsonElement("""{"type":"explanation","layout":"invalid"}""").jsonObject }
            instrumentation.waitForIdleSync()
            var failed: WebView? = null
            waitFor {
                instrumentation.runOnMainSync { failed = findWeb(activity.window.decorView) }
                failed != null && js(failed!!, "!!document.querySelector('.component-error[role=alert]')") == "true"
            }
            waitFor {
                var height = 0f
                instrumentation.runOnMainSync { height = failed!!.height / context.resources.displayMetrics.density }
                height < 166f
            }
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
}
