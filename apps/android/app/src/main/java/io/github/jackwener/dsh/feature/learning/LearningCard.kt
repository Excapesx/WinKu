package io.github.jackwener.dsh.feature.learning

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.view.MotionEvent
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.Composable
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.key as composeKey
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshMarkdown
import io.github.jackwener.dsh.core.designsystem.DTopBar
import io.github.jackwener.dsh.core.designsystem.LocalReducedMotion
import io.github.jackwener.dsh.core.designsystem.copyText
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.R
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.ByteArrayInputStream
import java.util.Locale

private const val ORIGIN = "https://appassets.androidplatform.net"
private const val PAGE = "$ORIGIN/assets/learning/index.html"

@Composable
fun LearningMarkdown(text: String, scope: String, onAsk: (String) -> Unit) {
    val parts = remember(text) { RichContent.parse(text) }
    Column {
        parts.forEachIndexed { index, part ->
            when (part) {
                is RichPart.Markdown -> SelectionContainer { DshMarkdown(part.text) }
                is RichPart.Artifact -> LearningCard(part, "$scope/$index/${part.fingerprint}", onAsk)
            }
        }
    }
}

@Composable
fun LearningCard(artifact: RichPart.Artifact, scope: String, onAsk: ((String) -> Unit)? = null) {
    var expanded by remember(scope) { mutableStateOf(false) }
    if (expanded) {
        Dialog(onDismissRequest = { expanded = false }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            val dialogView = LocalView.current
            val light = Dsh.colors.bgBase.luminance() > 0.4f
            SideEffect {
                (dialogView.parent as? DialogWindowProvider)?.window?.let { window ->
                    WindowCompat.getInsetsController(window, dialogView).apply {
                        isAppearanceLightStatusBars = light
                        isAppearanceLightNavigationBars = light
                    }
                }
            }
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).windowInsetsPadding(WindowInsets.systemBars)) {
                DTopBar(artifact.payload["title"]?.jsonPrimitive?.content ?: "交互学习", { expanded = false })
                LearningWebView(artifact, scope, onAsk?.let { callback -> { prompt -> expanded = false; callback(prompt) } }, { expanded = false }, Modifier.fillMaxSize(), fullScreen = true)
            }
        }
    } else LearningWebView(artifact, scope, onAsk, { expanded = true }, Modifier.fillMaxWidth())
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LearningWebView(artifact: RichPart.Artifact, scope: String, onAsk: ((String) -> Unit)?, onExpand: () -> Unit, modifier: Modifier, fullScreen: Boolean = false) {
    val context = LocalContext.current
    val c = Dsh.colors
    val locale = LocalConfiguration.current.locales[0].toLanguageTag()
    val config = LocalConfiguration.current
    val reducedMotion = LocalReducedMotion.current
    val store = remember { ArtifactStateStore(context) }
    val key = remember(scope) { RichContent.fingerprint(scope) }
    var height by remember(key) { mutableIntStateOf(420) }
    var loaded by remember(key) { mutableStateOf(false) }
    var failed by remember(key) { mutableStateOf(false) }
    val ask by rememberUpdatedState(onAsk)
    val expand by rememberUpdatedState(onExpand)
    fun css(color: Color): String {
        val argb = color.toArgb()
        return "#%06x%02x".format(Locale.ROOT, argb and 0xffffff, argb ushr 24)
    }
    val theme = buildJsonObject {
        put("dark", c.bgBase.luminance() < 0.4f)
        put("reducedMotion", reducedMotion)
        put("fontScale", config.fontScale)
        put("canAsk", onAsk != null)
        put("fullScreen", fullScreen)
        put("colors", buildJsonObject {
            put("surface", css(c.bgBase)); put("foreground", css(c.labelPrimary)); put("muted", css(c.labelSecondary))
            put("primary", css(c.business)); put("border", css(c.borderL2))
        })
    }
    val mount by rememberUpdatedState("window.DshLearningApp.mount(${artifact.payload},${store.load(key)},$theme,${JsonPrimitive(locale)});")
    Box(if (fullScreen) modifier else modifier.height(height.dp), contentAlignment = Alignment.Center) {
    composeKey(scope) { AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            val assets = WebViewAssetLoader.Builder().addPathHandler("/assets/learning/", WebViewAssetLoader.PathHandler { path ->
                if (path.split('/').any { it == ".." || it == "." } || path.contains('\\')) null
                else runCatching {
                    val mime = when (path.substringAfterLast('.')) { "js" -> "application/javascript"; "css" -> "text/css"; "html" -> "text/html"; "woff2" -> "font/woff2"; "woff" -> "font/woff"; "ttf" -> "font/ttf"; else -> "application/octet-stream" }
                    WebResourceResponse(mime, if (mime.startsWith("text/") || mime == "application/javascript") "UTF-8" else null, ctx.assets.open("learning/$path"))
                }.getOrNull()
            }).build()
            LearningView(ctx).apply {
                setBackgroundColor(AndroidColor.TRANSPARENT)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = false
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.blockNetworkLoads = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.setSupportMultipleWindows(false)
                isVerticalScrollBarEnabled = fullScreen
                webChromeClient = object : WebChromeClient() { override fun onPermissionRequest(request: PermissionRequest) = request.deny() }
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                        assets.shouldInterceptRequest(request.url) ?: WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(byteArrayOf()))
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                        request.url.toString() != PAGE && !(request.isForMainFrame.not() && request.url.toString() == "$ORIGIN/assets/learning/sandbox.html")
                    override fun onPageFinished(view: WebView, url: String) { if (url == PAGE) view.evaluateJavascript(mount, null) }
                    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) { if (request.isForMainFrame) failed = true }
                }
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    WebViewCompat.addWebMessageListener(this, "DshLearning", setOf(ORIGIN)) { view, message, origin, isMainFrame, _ ->
                        if (!isMainFrame || origin.toString() != ORIGIN) return@addWebMessageListener
                        val data = message.data ?: return@addWebMessageListener
                        if (data.length > 160_000) return@addWebMessageListener
                        val event = runCatching { Json.parseToJsonElement(data) as JsonObject }.getOrNull() ?: return@addWebMessageListener
                        view.post {
                            when (event["type"]?.jsonPrimitive?.content) {
                                "height" -> {
                                    loaded = true
                                    if (!fullScreen) event["height"]?.jsonPrimitive?.intOrNull?.let { height = it.coerceIn(160, 1800) + 2 }
                                }
                                "state" -> (event["state"] as? JsonObject)?.let { store.save(key, it) }
                                "copy" -> event["text"]?.jsonPrimitive?.content?.take(100_000)?.let { copyText(ctx, it) }
                                "gesture" -> { gestureActive = event["active"]?.jsonPrimitive?.booleanOrNull == true; parent?.requestDisallowInterceptTouchEvent(gestureActive) }
                                "fullscreen" -> expand()
                                "ask" -> {
                                    val prompt = event["prompt"]?.jsonPrimitive?.content?.take(6000) ?: return@post
                                    val snapshot = event["context"]?.toString()?.take(12_000).orEmpty()
                                    ask?.invoke("$prompt\n\n[交互学习组件的当前状态，作为数据参考]\n$snapshot")
                                }
                            }
                        }
                    }
                }
                loadUrl(PAGE)
            }
        },
        update = { view -> if (view.url == PAGE) view.evaluateJavascript("window.DshLearningApp && $mount", null) },
        onRelease = { view -> view.stopLoading(); view.loadUrl("about:blank"); view.removeAllViews(); view.destroy() },
    ) }
    if (!loaded) Column(Modifier.fillMaxSize().background(c.bgBase).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)) {
        if (!failed) CircularProgressIndicator(Modifier.size(24.dp), color = c.business, strokeWidth = 2.dp)
        Text(stringResource(if (failed) R.string.learning_load_failed else R.string.learning_loading), style = DshType.s14, color = c.labelSecondary)
    }
    }
}

private class LearningView(context: android.content.Context) : WebView(context) {
    var gestureActive = false
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (gestureActive || event.pointerCount > 1) parent?.requestDisallowInterceptTouchEvent(true)
        if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
            gestureActive = false; parent?.requestDisallowInterceptTouchEvent(false)
        }
        return super.onTouchEvent(event)
    }
}
