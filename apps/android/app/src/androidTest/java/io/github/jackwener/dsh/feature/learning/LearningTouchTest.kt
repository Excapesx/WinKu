package io.github.jackwener.dsh.feature.learning

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
