package io.github.jackwener.dsh.feature.learning

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshTheme
import android.content.Intent
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Real Android WebView, real two-pointer MotionEvents, no model/network/device permissions. */
class LearningTouchTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWebView(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var result = "null"
        instrumentation.runOnMainSync { view.evaluateJavascript(code) { result = it; latch.countDown() } }
        assertTrue("WebView callback", latch.await(5, TimeUnit.SECONDS)); return result
    }
    private fun waitFor(condition: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 30000
        while (SystemClock.uptimeMillis() < until) { if (condition()) return; Thread.sleep(100) }
        fail("Timed out waiting for packaged learning content")
    }
    private fun capture(name: String) {
        if (InstrumentationRegistry.getArguments().getString("screenshots") != "true") return
        instrumentation.waitForIdleSync()
        Thread.sleep(350)
        instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
            java.io.File(instrumentation.targetContext.externalCacheDir, "$name.png").outputStream().use {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            bitmap.recycle()
        }
    }
    @Test fun inlineHeightFollowsContentWhenFormulaGrowsAndShrinks() {
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as ComponentActivity
        val short = "\\forall\\varepsilon>0,\\exists\\delta>0:0<|x-x_0|<\\delta\\Rightarrow|f(x)-A|<\\varepsilon"
        val formula = mutableStateOf(short)
        val scale = mutableStateOf(1f)
        instrumentation.runOnMainSync { activity.setContent {
            val config = android.content.res.Configuration(context.resources.configuration).apply { fontScale = scale.value }
            CompositionLocalProvider(LocalConfiguration provides config) { DshTheme {
                Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding()
                    .verticalScroll(rememberScrollState()).padding(16.dp)) {
                    val payload = kotlinx.serialization.json.buildJsonObject {
                        put("type", kotlinx.serialization.json.JsonPrimitive("math"))
                        put("id", kotlinx.serialization.json.JsonPrimitive("height-regression"))
                        put("title", kotlinx.serialization.json.JsonPrimitive("函数极限的 ε-δ 定义"))
                        put("latex", kotlinx.serialization.json.JsonPrimitive(formula.value))
                    }
                    LearningCard(RichPart.Artifact(payload, "height-regression"), "height-regression", {})
                    Spacer(Modifier.height(16.dp))
                    androidx.compose.material3.Text("通俗地说：误差足够小，函数值就能任意接近极限。", color = Dsh.colors.labelPrimary)
                }
            } }
        } }
        try {
            var web: WebView? = null
            waitFor {
                instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }
                web != null && js(web!!, "!!document.querySelector('.math-block .katex') && document.fonts.status === 'loaded'") == "true"
            }
            fun mount(latex: String, fontScale: Float = 1f) {
                instrumentation.runOnMainSync { formula.value = latex; scale.value = fontScale }
                waitFor { Json.parseToJsonElement(js(web!!, "document.querySelector('annotation')?.textContent")).jsonPrimitive.content == latex }
            }
            fun measurements(): Pair<Float, Float> {
                val content = js(web!!, "Math.ceil(document.querySelector('.component-shell').getBoundingClientRect().height)").toFloat()
                var native = 0f
                instrumentation.runOnMainSync { native = web!!.height / context.resources.displayMetrics.density }
                return native to content
            }
            fun assertFits(label: String) {
                waitFor {
                    val (native, content) = measurements()
                    kotlin.math.abs(native - (content.coerceIn(160f, 1800f) + 2)) < 3f &&
                        js(web!!, "document.querySelector('.component-footer').getBoundingClientRect().bottom <= innerHeight + 2") == "true"
                }
                val (native, content) = measurements()
                android.util.Log.i("LearningHeightTest", "$label: native=$native dp, card=$content CSS px")
            }
            assertFits("short formula")
            capture("formula-height-fixed")
            val shortHeight = measurements().first
            assertEquals("Long formula stays horizontally scrollable", "true", js(web!!,
                "(()=>{const el=document.querySelector('.math-block');return el.scrollWidth>el.clientWidth})()"))
            mount("\\begin{aligned}" + (1..12).joinToString("\\\\") { "x_{$it}&=$it" } + "\\end{aligned}")
            waitFor { measurements().second > shortHeight + 100 }
            assertFits("tall formula")
            mount(short)
            assertFits("short formula restored")
            assertTrue("Shrinks after tall content", measurements().first < shortHeight + 3)
            mount(short, 1.6f)
            waitFor { measurements().second > shortHeight + 10 }
            assertFits("large text")
            mount(short)
            assertFits("normal text restored")
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
    @Test fun mathematicalProseStreamsInTheSameWebViewAndLongAnswersStayVisible() {
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as ComponentActivity
        val text = mutableStateOf("公式：${'$'}\\frac{1}")
        instrumentation.runOnMainSync { activity.setContent { DshTheme {
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding()
                .verticalScroll(rememberScrollState()).padding(16.dp)) {
                LearningMarkdown(text.value, "math-prose-regression", {})
            }
        } } }
        try {
            var web: WebView? = null
            waitFor {
                instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }
                web != null && js(web!!, "!!document.querySelector('.math-pending')") == "true"
            }
            val initialWeb = web!!
            val answer = """
                ## 一句话核心
                把**“两个无穷小谁快谁慢”**的比较，换成导数的比较。

                ## 三道例题
                ① 用一次洛必达：§\displaystyle\lim_{x\to0}\frac{\sin x}{x}=\lim_{x\to0}\frac{\cos x}{1}=1§

                ② 连续用两次：
                §\begin{aligned}\lim_{x\to0}\frac{1-\cos x}{x^2}&=\lim_{x\to0}\frac{\sin x}{2x}\\&=\lim_{x\to0}\frac{\cos x}{2}=\frac12\end{aligned}§

                第一次仍是 §0/0§，先重新检查条件，再用一次。

                ③ 先转化再使用：§\lim_{x\to0^+}x\ln x=0§。
            """.trimIndent().replace('§', '$')
            val streamedAnswer = text.value + "{2}${'$'}。\n\n" + answer
            for (end in text.value.length + 1..streamedAnswer.length step 41) {
                instrumentation.runOnMainSync { text.value = streamedAnswer.take(end) }
                Thread.sleep(35)
            }
            instrumentation.runOnMainSync { text.value = streamedAnswer }
            waitFor { js(initialWeb, "document.querySelectorAll('.math-text .mfrac').length >= 6 && !document.querySelector('.math-pending,.math-error')") == "true" }
            instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }
            assertSame("Appending math does not recreate the WebView", initialWeb, web)
            assertEquals("Chinese emphasis is typeset", "true", js(initialWeb, "!!document.querySelector('strong') && !document.querySelector('.math-text').innerText.includes('**')"))
            capture("math-prose-fixed")
            val longAnswer = streamedAnswer + "\n\n" + (1..90).joinToString("\n\n") { "第 $it 步：先检查适用条件，再计算极限。" } + "\n\n长文终点。<img src=x onerror='window.__injected=true'>"
            instrumentation.runOnMainSync { text.value = longAnswer }
            waitFor {
                val content = js(initialWeb, "Math.ceil(document.querySelector('.text-document').getBoundingClientRect().height)").toFloat()
                var native = 0f
                instrumentation.runOnMainSync { native = initialWeb.height / context.resources.displayMetrics.density }
                content > 1800 && kotlin.math.abs(native - content - 2) < 3
            }
            assertEquals("No executable generated HTML in prose", "false", js(initialWeb, "!!document.querySelector('.text-document img,.text-document script,.text-document iframe') || window.__injected===true"))
            assertEquals("End of a long answer is present", "true", js(initialWeb, "document.querySelector('.math-text').innerText.includes('长文终点。')"))
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
    @Test fun quizRendersTextbookFractionsInQuestionOptionsHintsAndFeedback() {
        val context = instrumentation.targetContext
        ArtifactStateStore(context).save(RichContent.fingerprint("math-quiz-regression"), kotlinx.serialization.json.JsonObject(emptyMap()))
        val activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as ComponentActivity
        val payload = Json.parseToJsonElement("""
            {"type":"quiz","id":"math-quiz-regression","title":"理解检查","questions":[{
              "prompt":"lim(x→0) (e^x - 1 - x)/x² 等于?",
              "options":["0","1/2","1"],"answer":1,
              "hint":"先检查是否为 §0/0§ 型。",
              "explanation":"连续使用两次洛必达：§§\\lim_{x\\to0}\\frac{e^x}{2}=\\frac12§§。"
            }]}
        """.trimIndent().replace('§', '$')).jsonObject
        instrumentation.runOnMainSync { activity.setContent { DshTheme {
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding()
                .verticalScroll(rememberScrollState()).padding(16.dp)) {
                LearningCard(RichPart.Artifact(payload, "quiz"), "math-quiz-regression", {})
            }
        } } }
        try {
            var web: WebView? = null
            waitFor {
                instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }
                web != null && js(web!!, "!!document.querySelector('.quiz-question .mfrac') && !!document.querySelectorAll('.quiz-option')[1]?.querySelector('.mfrac')") == "true"
            }
            assertEquals("Progress uses words", "false", js(web!!, "document.querySelector('.quiz-progress').innerText.includes('/')"))
            capture("math-quiz-fixed")
            js(web!!, "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('给我一点提示')).click()")
            waitFor { js(web!!, "!!document.querySelector('.hint .mfrac')") == "true" }
            js(web!!, "document.querySelectorAll('.quiz-option')[1].click()")
            waitFor { js(web!!, "!document.querySelector('.primary-button').disabled") == "true" }
            js(web!!, "document.querySelector('.primary-button').click()")
            waitFor { js(web!!, "!!document.querySelector('.answer-feedback.is-correct .mfrac') && !document.querySelector('.math-error')") == "true" }
            capture("math-quiz-feedback-fixed")
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }
    @Test fun pinchChangesDomainAndPersistsAcrossReopen() {
        val context = instrumentation.targetContext
        val store = ArtifactStateStore(context)
        val key = RichContent.fingerprint("examples/0")
        store.save(key, kotlinx.serialization.json.JsonObject(emptyMap()))
        var activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        var web: WebView? = null
        waitFor { instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }; web != null && js(web!!, "!!document.querySelector('.function-canvas svg path')") == "true" }
        val rect = Json.parseToJsonElement(js(web!!, "JSON.stringify((()=>{const r=document.querySelector('.function-canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,dpr:devicePixelRatio};})())")).jsonPrimitive.content
        val bounds = Json.parseToJsonElement(rect).jsonObject
        fun number(name: String) = bounds[name]!!.jsonPrimitive.content.toFloat()
        val density = number("dpr")
        val location = IntArray(2)
        instrumentation.runOnMainSync { web!!.getLocationOnScreen(location) }
        val cx = location[0] + (number("x") + number("width") * .5f) * density
        val cy = location[1] + (number("y") + number("height") * .5f) * density
        val downTime = SystemClock.uptimeMillis()
        fun event(action: Int, distance: Float, count: Int = 2) {
            val properties = Array(count) { i -> MotionEvent.PointerProperties().apply { id = i; toolType = MotionEvent.TOOL_TYPE_FINGER } }
            val coordinates = Array(count) { i -> MotionEvent.PointerCoords().apply { x = cx + (if (i == 0) -distance else distance); y = cy; pressure = 1f; size = 1f } }
            val e = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, count, properties, coordinates, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
            instrumentation.sendPointerSync(e); e.recycle(); Thread.sleep(40)
        }
        event(MotionEvent.ACTION_DOWN, 35f * density, 1)
        event(MotionEvent.ACTION_POINTER_DOWN or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT), 35f * density)
        for (i in 1..8) event(MotionEvent.ACTION_MOVE, (35f + 5f * i) * density)
        event(MotionEvent.ACTION_POINTER_UP or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT), 75f * density)
        event(MotionEvent.ACTION_UP, 75f * density, 1)
        val visible = Json.parseToJsonElement(Json.parseToJsonElement(js(web!!, "document.querySelector('.function-canvas').getAttribute('data-viewport')")).jsonPrimitive.content).jsonObject
        waitFor { store.load(key)["view"] == visible }
        val saved = store.load(key)["view"]!!.jsonObject["x"]!!.jsonArray.map { it.jsonPrimitive.content.toDouble() }
        assertTrue("Pinch should zoom in", saved[1] - saved[0] < 9)
        val zoomedPath = js(web!!, "document.querySelector('.function-canvas path[stroke]').getAttribute('d')")
        instrumentation.runOnMainSync { activity.finish() }
        instrumentation.waitForIdleSync()
        activity = instrumentation.startActivitySync(Intent(context, LearningActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        waitFor { instrumentation.runOnMainSync { web = findWebView(activity.window.decorView) }; web != null && js(web!!, "!!document.querySelector('.function-canvas svg path')") == "true" }
        waitFor { js(web!!, "document.querySelector('.function-canvas path[stroke]').getAttribute('d')") == zoomedPath }
        assertEquals(saved, store.load(key)["view"]!!.jsonObject["x"]!!.jsonArray.map { it.jsonPrimitive.content.toDouble() })
        instrumentation.runOnMainSync { activity.finish() }
    }
}
