package io.github.jackwener.dsh.core.engine

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.util.Log
import dagger.Lazy
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jackwener.dsh.core.capability.CapabilityHub
import io.github.jackwener.dsh.core.data.SecretStore
import io.github.jackwener.dsh.core.data.SettingsRepository
import io.github.jackwener.dsh.core.provider.ReasoningLevels
import io.github.jackwener.dsh.core.provider.renderProfilePatch
import io.github.jackwener.dsh.core.session.SessionStore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.File
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

sealed interface EngineState {
    data object Stopped : EngineState
    data object Starting : EngineState
    data object Ready : EngineState
    data class Failed(val message: String) : EngineState
}

class EngineStartException(message: String, val log: String?, cause: Throwable) : Exception(message, cause)
/** Android refused to start the engine's foreground service from the background (Android 12+). */
class EngineBackgroundStartException(cause: Throwable) : Exception("foreground service start not allowed from the background", cause)

/**
 * The process-wide SDK route (`initialize`): explicit provider + model and a reasoning level
 * reported by that model, or "" to use its default.
 */
data class EngineRoute(val provider: String, val model: String, val effort: String)

/** The selected model cannot run. It is never replaced with a different route. */
class RouteUnavailableException(message: String) : Exception(message)

/**
 * Owns the `:engine` process from the app side: starts it on demand, wires the SDK and capability
 * channels, and shuts it down after idling. See docs/ENGINE-CONTRACT.md.
 *
 * All providers use Settings.providers, named SecretStore slots and the llm-service-lite adapter.
 * Only DSH_ANDROID_KEY_<ID> credential variables are exported; there is no built-in vendor route.
 *
 * Third-party providers (Settings → 模型服务): the app writes its settings layer
 * `$DSH_HOME/android/app-layer.patch.yml` (a launcher overlay; llm-service-lite providers, see
 * core/provider/Providers.kt) before each start and passes each provider key as
 * `DSH_ANDROID_KEY_<ID>`. Both are read once at process start, so a change to either (the
 * [profileFingerprint]) restarts the engine when it is idle, like a route change.
 */
@Singleton
class EngineManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: SettingsRepository,
    private val secrets: SecretStore,
    private val capabilities: Lazy<CapabilityHub>,
    private val sessions: Lazy<SessionStore>,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + CoroutineExceptionHandler { _, e -> Log.e(TAG, "engine task crashed", e) })
    private val mutex = Mutex()
    private val _state = MutableStateFlow<EngineState>(EngineState.Stopped)
    val state: StateFlow<EngineState> = _state.asStateFlow()

    private var sdk: JsonRpcPeer? = null
    private var bridge: JsonRpcPeer? = null
    private var connection: ServiceConnection? = null
    private var idleJob: Job? = null
    var startupMillis: Long = 0; private set

    /** Incremented on every engine start; sessions must be resumed once per generation. */
    @Volatile var generation: Int = 0; private set
    /**
     * Highest generation that has been torn down (stopped, crashed or failed to start). Anything a
     * retired generation still delivers describes a process that no longer exists.
     */
    @Volatile var retiredGeneration: Int = 0; private set
    private val _route = MutableStateFlow<EngineRoute?>(null)
    /** Route of the running engine (null while stopped). A settings change that differs waits until no run is active. */
    val route: StateFlow<EngineRoute?> = _route.asStateFlow()
    private var activeRoute: EngineRoute?
        get() = _route.value
        set(v) { _route.value = v }
    /** Device time zone the running engine was started with (TZ is read once, at process start). */
    @Volatile private var startedTz: String = TimeZone.getDefault().id
    /** DSH_ANDROID_LOCALE the running process got (approval texts and extension labels follow the app language). */
    @Volatile private var startedLocale: String = Locale.getDefault().toLanguageTag()
    /** Whether an SDK session was opened in this generation (then a route change needs a restart). */
    @Volatile private var sessionsOpened = false
    private var death: CompletableDeferred<Unit>? = null
    /** Generation we asked to exit; its channel closing is not a crash. */
    @Volatile private var expectedExit = -1
    /** Backoff + circuit breaker for unexpected engine exits (see RestartPolicy). */
    val restarts = RestartPolicy()

    private fun wantedRoute(st: io.github.jackwener.dsh.core.data.Settings): EngineRoute {
        val choice = st.choice
        choice.provider?.let { p ->
            val reasoning = ReasoningLevels.of(p, choice.model, engineReasoning ?: st.reasoningCatalog)
            return EngineRoute(p.id, choice.model, ReasoningLevels.effective(reasoning, st.reasoningChoice).orEmpty())
        }
        return EngineRoute(choice.providerId, choice.model, st.reasoningEffort.orEmpty())
    }

    private fun profilePatch(st: io.github.jackwener.dsh.core.data.Settings) = io.github.jackwener.dsh.core.extensions.appendPatchRows(
        renderProfilePatch(st.providers, webSearch = false, io.github.jackwener.dsh.core.provider.appProductToken(io.github.jackwener.dsh.BuildConfig.VERSION_NAME)),
        io.github.jackwener.dsh.core.extensions.ExtensionsEngineInputs.patchRows(st.mcpServers, File(context.filesDir, "dsh-home").path))

    /** Provider keys and secret header values, plus the extensions' environment (plugin registries, MCP header secrets): env var name → value. */
    private fun providerKeys(st: io.github.jackwener.dsh.core.data.Settings): Map<String, String> {
        return io.github.jackwener.dsh.core.provider.providerEnvironment(st.providers, secrets::read) +
            io.github.jackwener.dsh.core.extensions.ExtensionsEngineInputs.env(st.pluginRegistry, st.pluginRegistryCustom, st.mcpServers, secrets::read)
    }

    /** What a running process has baked in at start: the patch layer and the provider keys (hashed, never stored). */
    private fun profileFingerprint(st: io.github.jackwener.dsh.core.data.Settings): String {
        return io.github.jackwener.dsh.core.provider.providerFingerprint(profilePatch(st), providerKeys(st))
    }
    @Volatile private var activeFingerprint: String? = null
    /** Reasoning levels the running engine reported (null until it answers); [wantedRoute] prefers them to the stored copy. */
    @Volatile private var engineReasoning: Map<String, io.github.jackwener.dsh.core.provider.ModelReasoning>? = null

    /**
     * Returns a ready SDK peer for prompts, starting the engine if needed. The route is
     * process-wide (`initialize`): a changed model / effort / credential route re-initializes an
     * engine that has not opened sessions yet, or restarts an idle one, before the next prompt.
     * A changed configuration waits for active runs to finish; new prompts never use the old route.
     */
    /** The running engine's channel, without starting one (null while stopped or starting). */
    fun sdkIfReady(): JsonRpcPeer? = sdk?.takeIf { state.value == EngineState.Ready }

    suspend fun sdk(): JsonRpcPeer = mutex.withLock {
        val st = settings.current()
        val choice = st.choice
        choice.validate(secrets::read)?.let { problem ->
            throw RouteUnavailableException(context.getString(problem.messageRes, choice.provider?.name ?: choice.providerId, choice.model))
        }
        val peer = sdk?.takeIf { _state.value == EngineState.Ready }?.let { peer ->
            val want = wantedRoute(st)
            when {
                sessions.get().hasEngineRuns() -> {
                    if (want != activeRoute || profileFingerprint(st) != activeFingerprint)
                        throw RouteUnavailableException(context.getString(io.github.jackwener.dsh.R.string.model_config_busy))
                    peer
                }
                // The device time zone changed since start: a new process picks it up (when idle, like a route change).
                TimeZone.getDefault().id != startedTz -> { Log.i(TAG, "time zone changed: restarting engine"); shutdownLocked(); null }
                // The app language changed (设置 → 语言, or the system's per-app language): same, when idle.
                Locale.getDefault().toLanguageTag() != startedLocale -> { Log.i(TAG, "language changed: restarting engine"); shutdownLocked(); null }
                // Providers / keys / web search changed: only a new process reads them.
                profileFingerprint(st) != activeFingerprint -> { Log.i(TAG, "model providers changed: restarting engine"); shutdownLocked(); null }
                want == activeRoute -> peer
                !sessionsOpened -> peer
                else -> { Log.i(TAG, "route changed: restarting engine"); shutdownLocked(); null }
            }
        } ?: startLocked(st)
        val want = wantedRoute(st)
        if (want != activeRoute) {
            try { initialize(peer, want) }
            catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (e: Exception) {
                throw RouteUnavailableException(context.getString(io.github.jackwener.dsh.R.string.model_config_init_failed,
                    choice.provider?.name ?: want.provider, want.model, e.message ?: e.javaClass.simpleName))
            }
        }
        peer
    }

    /** Control traffic (extensions, profile) needs no model credential or model initialization. */
    suspend fun control(): JsonRpcPeer = mutex.withLock {
        sdk?.takeIf { _state.value == EngineState.Ready } ?: startLocked(settings.current())
    }

    /** SessionStore is about to open (create/resume) an SDK session in the current generation. */
    fun markSessionOpened() { sessionsOpened = true }

    private suspend fun initialize(peer: JsonRpcPeer, route: EngineRoute) {
        withTimeout(90_000) {
            peer.request("initialize", buildJsonObject {
                put("cwd", File(context.filesDir, "home").path)
                put("provider", route.provider)
                put("model", route.model)
                if (route.effort.isNotEmpty()) put("reasoningEffort", route.effort)
                put("approvalRequests", true)
                putJsonObject("capabilities") { put("userQuestions", true) }
            })
        }
        activeRoute = route
        Log.i(TAG, "SDK route ${route.provider}/${route.model}/${route.effort}")
    }

    /**
     * Ask the engine for every third-party model's reasoning levels (`android/models/reasoning`,
     * plugin-guard; #46) and store them: the composer lists them, and [wantedRoute] sends a saved
     * level only while the model offers it. Unanswered (timeout, error) keeps the stored catalog.
     */
    private suspend fun refreshReasoning(peer: JsonRpcPeer, st: io.github.jackwener.dsh.core.data.Settings) {
        val routes = st.providers.filter { it.enabled && it.models.isNotEmpty() && it.baseUrl.isNotBlank() }.flatMap { p -> p.models.map { p to it } }
        if (routes.isEmpty()) return
        val result = runCatching {
            withTimeout(30_000) {
                peer.request("android/models/reasoning", buildJsonObject {
                    putJsonArray("models") { routes.forEach { (p, m) -> addJsonObject { put("provider", p.id); put("model", m) } } }
                })
            }
        }.onFailure { Log.w(TAG, "android/models/reasoning unavailable", it) }.getOrNull() ?: return
        val catalog = ReasoningLevels.parse(result) { provider, model -> st.providers.firstOrNull { it.id == provider }?.limits?.get(model)?.reasoning }
        engineReasoning = catalog
        runCatching { settings.setReasoningCatalog(catalog) }.onFailure { Log.w(TAG, "could not store reasoning levels", it) }
    }

    private suspend fun startLocked(st: io.github.jackwener.dsh.core.data.Settings): JsonRpcPeer {
        _state.value = EngineState.Starting
        val t0 = System.currentTimeMillis()
        val gen = generation + 1
        try {
            var service = bind(gen)
            if (runCatching { service.isRunning() }.getOrDefault(false)) {
                // A previous :main died while :engine survived; Node runs once per process, so replace it.
                Log.w(TAG, "engine process already ran Node; replacing it")
                val dying = death
                connection?.let { runCatching { context.unbindService(it) } }
                connection = null
                killEngineProcess()
                withTimeoutOrNull(5_000) { dying?.await() }
                service = bind(gen)
            }
            val tBound = System.currentTimeMillis()
            val processKeys = providerKeys(st)
            val patch = profilePatch(st)
            val fingerprint = io.github.jackwener.dsh.core.provider.providerFingerprint(patch, processKeys)
            withContext(Dispatchers.IO) { writeProfilePatch(patch) }
            val handles = withContext(Dispatchers.IO) { service.start(environment(processKeys)) }
            val sdkIn = ParcelFileDescriptor.AutoCloseOutputStream(handles.pfd("sdk_in"))
            val sdkOut = ParcelFileDescriptor.AutoCloseInputStream(handles.pfd("sdk_out"))
            val bridgeFd = handles.pfd("bridge")
            val peer = JsonRpcPeer("sdk", sdkOut, sdkIn, scope,
                onRequest = { m, p -> sessions.get().onServerRequest(m, p) },
                onNotification = { m, p -> if (!m.startsWith("account.")) sessions.get().onNotification(m, p, gen) },
                onClosed = { onEngineGone(gen) })
            val bridgePeer = JsonRpcPeer("bridge",
                ParcelFileDescriptor.AutoCloseInputStream(bridgeFd),
                ParcelFileDescriptor.AutoCloseOutputStream(ParcelFileDescriptor.dup(bridgeFd.fileDescriptor)),
                scope,
                onRequest = { m, p -> capabilities.get().onBridgeRequest(m, p) },
                onNotification = { m, p -> if (m == "budget/exceeded") sessions.get().onBudgetExceeded(p) else capabilities.get().onBridgeNotification(m, p) },
                onClosed = {})
            peer.start(); bridgePeer.start()
            sessionsOpened = false
            // Before `initialize`: the route's reasoning level must be one this engine accepts.
            engineReasoning = null
            refreshReasoning(peer, st)
            val tBooted = System.currentTimeMillis()
            // Model initialization belongs to sdk(): extension management can run before any model is configured.
            activeFingerprint = fingerprint
            sdk = peer; bridge = bridgePeer
            generation = gen
            capabilities.get().attach(bridgePeer)
            bridgePeer.notify("budget/update", buildJsonObject {
                if (st.sessionTokenLimit > 0) put("sessionTokenLimit", st.sessionTokenLimit)
                if (st.dailyTokenLimit > 0) put("dailyTokenLimit", st.dailyTokenLimit)
            })
            startupMillis = System.currentTimeMillis() - t0
            _state.value = EngineState.Ready
            Log.i(TAG, "engine gen $gen ready for control in ${startupMillis}ms (bind ${tBound - t0}, boot ${tBooted - tBound})")
            scope.launch { delay(RestartPolicy.STABLE_MS); if (generation == gen && sdk === peer) restarts.recordHealthy() }
            return peer
        } catch (e: Exception) {
            Log.e(TAG, "engine start failed", e)
            if (e is EngineBackgroundStartException) { teardown(gen); throw e }
            restarts.recordFailure()
            val detail = engineLogTail()
            teardown(gen)
            killEngineProcess()
            _state.value = EngineState.Failed(listOfNotNull(e.message ?: e.javaClass.simpleName, detail).joinToString("\n"))
            throw EngineStartException(e.message ?: e.javaClass.simpleName, detail, e)
        }
    }

    private fun engineLogTail(): String? = runCatching {
        EngineDiagnostics.logTail(context, 600)
    }.getOrNull()

    /** Called when there is no running work; stops the engine after [IDLE_MS]. */
    fun scheduleIdleShutdown() {
        idleJob?.cancel()
        idleJob = scope.launch {
            delay(IDLE_MS)
            if (sessions.get().hasRunning()) return@launch
            stop()
        }
    }

    fun cancelIdleShutdown() { idleJob?.cancel() }

    /** Hard stop: the SDK has no cancel method, so stopping a turn means stopping the process. */
    suspend fun stop() = mutex.withLock { shutdownLocked() }

    /** Asks Node to exit and waits for the `:engine` process to die so the next start gets a fresh one. */
    private suspend fun shutdownLocked() {
        val dying = death
        expectedExit = generation
        runCatching { withTimeout(3_000) { sdk?.request("shutdown") } }
        teardown(generation)
        if (dying != null && withTimeoutOrNull(5_000) { dying.await() } == null) killEngineProcess()
    }

    /** Last resort for a wedged `:engine` process (Node can start only once per process). */
    private fun killEngineProcess() {
        val am = context.getSystemService(android.app.ActivityManager::class.java)
        am.runningAppProcesses?.filter { it.processName == context.packageName + ":engine" }?.forEach {
            Log.w(TAG, "killing engine process ${it.pid}")
            android.os.Process.killProcess(it.pid)
        }
    }

    fun notifyCapabilitiesChanged() {
        scope.launch { runCatching { bridge?.notify("capability/changed") } }
    }

    /**
     * The `:engine` process of [gen] went away unexpectedly. Three signals report it (the SDK
     * pipe's EOF, the binder death link, onServiceDisconnected) on different threads; only the
     * first counts, so one crash is one RestartPolicy failure and one onEngineLost.
     */
    private fun onEngineGone(gen: Int) {
        val peer: JsonRpcPeer
        val retryInMs: Long?
        synchronized(this) {
            peer = sdk ?: return
            if (gen != generation || gen == expectedExit) return
            Log.w(TAG, "engine gen $gen channel closed")
            teardown(gen)
            retryInMs = restarts.recordFailure()
        }
        scope.launch {
            // A binder-death signal can beat the pipe's EOF: let the dead channel's buffered tail
            // (events the process wrote before it died) reach SessionStore before the loss does.
            withTimeoutOrNull(2_000) { peer.closed.await() }
            sessions.get().onEngineLost(gen, retryInMs)
            delay(2_000) // let the system record the exit reason
            EngineDiagnostics.collectExitInfo(context)
        }
    }

    private fun teardown(retire: Int) {
        retiredGeneration = maxOf(retiredGeneration, retire)
        // Every request this generation is still serving (approval cards, device tool calls, unlock
        // waits) is void now: cancel them so nothing acts later or answers into a dead pipe (EngineCalls).
        val cause = EngineCallCancelled("engine generation $retire ended")
        sdk?.cancelRequests(cause); bridge?.cancelRequests(cause)
        sdk = null; bridge = null
        activeRoute = null
        capabilities.get().detach()
        connection?.let { runCatching { context.unbindService(it) } }
        connection = null
        context.stopService(Intent(context, EngineService::class.java))
        _state.value = EngineState.Stopped
    }

    private suspend fun bind(gen: Int): IEngineService {
        val deferred = CompletableDeferred<IEngineService>()
        val died = CompletableDeferred<Unit>().also { death = it }
        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder) {
                binder.linkToDeath({ died.complete(Unit); onEngineGone(gen) }, 0)
                deferred.complete(IEngineService.Stub.asInterface(binder))
            }
            override fun onServiceDisconnected(name: ComponentName?) { died.complete(Unit); onEngineGone(gen) }
        }
        val intent = Intent(context, EngineService::class.java)
        try {
            context.startForegroundService(intent)
        } catch (e: IllegalStateException) {
            // ForegroundServiceStartNotAllowedException (API 31+) extends IllegalStateException; older
            // releases throw a plain IllegalStateException for background starts.
            death = null
            throw EngineBackgroundStartException(e)
        }
        // No BIND_AUTO_CREATE: the started (START_NOT_STICKY) service alone keeps :engine alive. An
        // auto-create binding makes ActivityManager schedule its own restart of a crashed service
        // (1 s, then ×4 per crash, ≥10 s apart); while that restart is pending every new
        // startForegroundService/bindService waits for it, which delayed AC8 recovery by 10–25 s.
        // Restarts are RestartPolicy's job, so a crash must leave nothing scheduled in the system.
        check(context.bindService(intent, conn, Context.BIND_IMPORTANT)) { "bind failed" }
        connection = conn
        return withTimeout(20_000) { deferred.await() }
    }

    /**
     * The app's settings layer (PLUGINS-CONTRACT §1): `$DSH_HOME/android/app-layer.patch.yml`, which the engine entry
     * passes to dsh as a `--patch` overlay above every other layer. The profile's own `cordis.patch.yml` belongs to dsh
     * (plugin manager, config editor). Written atomically, only when it changed.
     */
    private fun writeProfilePatch(text: String) {
        val dir = File(context.filesDir, "dsh-home/android").apply { mkdirs() }
        val f = File(dir, "app-layer.patch.yml")
        if (f.exists() && f.readText() == text) return
        val tmp = File(dir, "app-layer.patch.yml.tmp")
        tmp.writeText(text)
        check(tmp.renameTo(f)) { "could not write ${f.path}" }
    }

    private fun environment(providerKeys: Map<String, String>) = Bundle().apply {
        startedTz = TimeZone.getDefault().id
        startedLocale = Locale.getDefault().toLanguageTag()
        val files = context.filesDir
        putString("DSH_HOME", File(files, "dsh-home").path)
        val bundledSkills = File(files, "bundled-skills")
        for (name in listOf("ppt-master", "lecture-notes")) {
            runCatching {
                val skill = File(bundledSkills, "$name/SKILL.md")
                context.assets.open("skills/$name/SKILL.md").use { asset ->
                    val content = asset.readBytes()
                    if (!skill.isFile || !skill.readBytes().contentEquals(content)) {
                        skill.parentFile?.mkdirs()
                        val staged = File(skill.parentFile, "SKILL.md.tmp")
                        staged.writeBytes(content)
                        check(staged.renameTo(skill)) { "Could not update bundled skill $name" }
                    }
                }
            }.onFailure { Log.w(TAG, "Could not load bundled skill $name", it) }
        }
        putString("DSH_BUNDLED_SKILL_DIR", bundledSkills.path)
        putString("HOME", File(files, "home").path)
        putString("TMPDIR", File(context.cacheDir, "tmp").path)
        putString("SHELL", "/system/bin/sh")
        putString("PATH", "${File(files, "bin").path}:/system/bin:/system/xbin")
        putString("DSH_NATIVE_DIR", context.applicationInfo.nativeLibraryDir)
        // The node launcher for engine children: bundled pnpm, npm stdio MCP servers (PLUGINS-CONTRACT §1).
        putString("DSH_NODE_BIN", File(context.applicationInfo.nativeLibraryDir, "libdshnode.so").path)
        providerKeys.forEach { (env, key) -> putString(env, key) }
        putString("DSH_ANDROID_PACKAGE", context.packageName)
        putString("DSH_ANDROID_LOCALE", startedLocale)
        // Node otherwise runs in UTC (local time for the model, daily budget at local midnight).
        // DSH_ANDROID_TZ lets the bundle's preload re-apply it where AT_SECURE makes Node drop TZ.
        putString("TZ", startedTz)
        putString("DSH_ANDROID_TZ", startedTz)
        putString("NODE_OPTIONS", "--max-old-space-size=768")
        putString("DSH_TELEMETRY_DISABLED", "1")
        putString("NARB_DISABLE_NATIVE_CACHE", "1")
        io.github.jackwener.dsh.core.extensions.SafeModeRequest.take(context, restarts.open)?.let { putString(io.github.jackwener.dsh.core.extensions.SafeModeRequest.ENV, it) }
    }

    private fun Bundle.pfd(key: String): ParcelFileDescriptor =
        @Suppress("DEPRECATION") (getParcelable<ParcelFileDescriptor>(key) ?: error("missing $key"))

    private companion object {
        const val TAG = "EngineManager"
        const val IDLE_MS = 5 * 60_000L
    }
}
