# DSH Ultra interactive learning

This fork extends DSH-Android **v0.3.8** with locally packaged, touch-friendly rich content. It does not change the model API or remote transport. The debug application ID is `io.github.jackwener.dsh.learning`, so it installs alongside the upstream app.

For installation and everyday use in Chinese, see [安装与使用](INTERACTIVE-LEARNING.zh-CN.md). The delivery APK is `out/DSH-Ultra-v0.3.8-fix1-arm64.apk`, displayed as **DSH Ultra**, version `0.3.8-learning.1` (versionCode 27), for Android 10 or later on arm64 devices. Provider/account setup is separate from installation. This extension does not integrate the `dsh-pocket` remote transport or reproduce every ChatGPT service.

## Use

Open **Settings → 交互学习** to try the offline component examples without starting the agent. In a conversation, ask for an explanation with an interactive function, diagram, quiz or teaching card. The engine prompt describes the format automatically. See [教学组件与生成方法](TEACHING-COMPONENTS.md) for the built-in generation guide and complete examples.

- Functions: add/remove/show/hide up to eight expressions; edit expressions; add parameters; change parameter values, bounds and step; pinch zoom; pan; tap a coordinate; fit/reset the viewport; fullscreen.
- Diagrams: Mermaid, pan, pinch zoom and reset.
- Charts: line, bar, scatter and pie; legend selection, touch inspection and Cartesian zoom.
- Quizzes: select, check, hint, explanation, next/previous question and retry.
- Math: KaTeX, with locally packaged fonts.
- Tables: sortable headers and horizontal scrolling.
- Code: syntax highlighting and copy; display only.
- Teaching cards: flows, step-by-step explanations, comparisons and learning summaries, with labelled semantic colors and mathematical text.
- HTML: a separate opaque sandbox for self-contained interactions, with no network or native access.

`结合我的操作讲解` sends the current functions/parameters/viewport or quiz state as an ordinary user follow-up in the same conversation. It does not send on every gesture. The offline gallery hides agent actions because it has no active conversation. Interaction snapshots are stored privately on the device, scoped by conversation, message, block position and payload fingerprint. At most 64 snapshots of 48 KB each are retained. Fullscreen and normal views share the snapshot.

## Message format

Use a complete, top-level fenced block. JSON is data, never an executable expression in the host document.

````markdown
```dsh-visual
{"version":1,"id":"quadratic","type":"function","title":"抛物线","functions":[{"expression":"a*x^2+b"}],"parameters":[{"name":"a","value":1,"min":-3,"max":3,"step":0.1},{"name":"b","value":0,"min":-4,"max":4,"step":0.1}],"xDomain":[-5,5],"yDomain":[-3,7]}
```
````

Other `type` values are `diagram`, `chart`, `quiz`, `math`, `table`, `code`, `html`, `explanation`. See `learning-ui/src/types.ts`, `schema.mjs`, `examples.ts` and `js/packages/plugin-guard/learning.js` for the fields. `mermaid`, `math` and explicit `dsh-html` fences are shortcuts. Ordinary `html` fences remain code. Incomplete streamed blocks, unsupported types and invalid JSON remain readable Markdown. Code fences that document another fence are not executed.

### Textbook mathematics (WinKu, 2026-11-06)

Conversation prose and every quiz text field support `$…$`, `$$…$$`, `\(…\)` and `\[…\]` using bundled KaTeX fonts. Use `\frac`, `\lim`, superscripts/subscripts and `aligned` derivations instead of programming-style fractions or `lim(x→0)`. Escape LaTeX backslashes in JSON. Clear legacy quiz limit expressions and standalone fraction options are converted with a bounded arithmetic AST; ordinary prose, code, dates and paths are not guessed or evaluated.

Mathematical prose uses a private `markdown` view, not a ninth public artifact type. Native Markdown continues to handle ordinary chat. WebView snapshots update without replacing the view; an unfinished formula shows a short pending indicator, then settles when its delimiter closes. Marked parses Markdown with math tokens before escape processing, raw HTML is escaped, DOMPurify sanitizes the result, and KaTeX runs without trusted HTML commands. HTTP(S) links open externally only after a user click. Card height comes from the observed content rectangle, never the viewport-dependent document scroll height; mathematical prose can exceed the normal chart height limit.

## Implementation

`RichContent.kt` splits completed blocks from Markdown. `LearningCard.kt` hosts packaged content through `WebViewAssetLoader` on an HTTPS app-assets origin. Its origin-restricted, main-frame-only `WebMessageListener` accepts bounded height/state/gesture/fullscreen/copy/follow-up events. It exposes no arbitrary method invocation or device tools. Outbound requests, file/content access and WebView permission requests are blocked. The HTML iframe has an opaque sandbox origin, a network-free CSP and no access to the native message listener. Mathematical expressions use a restricted mathjs AST: no assignment, object/property access, imports or evaluation functions.

The UI lives in `learning-ui/src`. React, mathjs, Mermaid, ECharts, KaTeX, syntax highlighting, icons and fonts are bundled into `app/src/main/assets/learning`; no runtime CDN is needed. Third-party notices are included next to the assets. The UI currently uses Chinese labels; native navigation retains the app's resource languages.

## Build on Windows

Use JDK 21 and the Android SDK matching the upstream project (platform 37.2 and its required build tools). Accept SDK licenses before building. Set `JAVA_HOME` and `ANDROID_HOME` for the shell; do not put credentials in Gradle properties.

```powershell
cd learning-ui
npm ci
npm run typecheck
npm test
npm run build
node scripts/prepare-engine.mjs 'D:\Downloads\DSH-Android-v0.3.8-arm64.apk'
cd ..
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest --tests '*RichContentTest' '-Pdsh.fetchShizuku=false'
node learning-ui/scripts/verify-apk.mjs app/build/outputs/apk/debug/app-debug.apk
```

The preparation script verifies the source APK against the official release SHA-256, reuses its matching engine/native libraries/Shizuku assets, overlays this fork's guard prompt, and writes a new engine hash under ignored `toolchains/out`. It does not modify the source APK. This path avoids cross-compiling Node on Windows. A full engine build using the upstream Linux scripts is also possible.

The APK is generated at `app/build/outputs/apk/debug/app-debug.apk`. This is a debug-signed personal build, not signed by the upstream author, and cannot replace an upstream install. An `Android SDK` emulator or a real device is needed to verify the native host. Browser previews verify the reusable web components, not the Android integration or phone permissions. No live model test is implied by a successful APK build.

`-Pdsh.learningPreview=true` builds an isolated x86_64 development app that opens the real conversation UI with labeled local sample sessions. Onboarding is skipped only in this development build; signing-in state and model credentials are not fabricated. Sending a message adds a local sample response without calling Node or a model provider. Its drawer, settings and composer use the native app code. The optional `learning_gallery=true` launch extra opens the offline component gallery for focused renderer testing. No account or API key is needed. It is not the arm64 delivery APK. Bundled JavaScript targets Chrome 100; Android's minimum OS version alone does not guarantee compatibility, so a sufficiently recent Android System WebView is required.

For browser development: `cd learning-ui; npm run dev`, then open `http://127.0.0.1:4173/?demo=function`. The dropdown covers all eight components.

## Verification and limits

### Engine startup packaging fix (learning.1, versionCode 27)

The first personal APK omitted `libc++_shared.so`, although `NodeRuntime` loads it before Node and several engine ELF files declare it in `DT_NEEDED`. This causes the engine thread to fail before starting Node, which can surface as an SDK pipe `EPIPE`. The reuse script now derives its library list from `native/prebuilt.sh`, including the C++ runtime, and checks actual ELF dependency closure. `learning-ui/scripts/verify-apk.mjs <apk>` rejects the original incomplete personal APK. Packaging regression tests run with `DSH_TEST_BASE_APK` set to the pinned upstream APK and include deletion of its C++ runtime. The corrected APK uses the same application ID and signing key, with a higher version code, for an in-place update. This is a packaging fix; physical-device engine startup still requires verification.

The final arm64 `assembleDebug` passed, as did four `RichContent` JVM tests, UI type checking, six UI Node tests and two plugin-guard tests. One native emulator instrumentation test performed an actual two-pointer zoom and verified the saved viewport survived reopening. It ran on Android 16 / API 36 with the x86_64 renderer-only build; it did not test the arm64 Node agent.

The approved native captures in `.impeccable/review/screenshots/` cover light mode, fullscreen, dark mode, text at 1.3×, quiz and diagram (`phone-light.png`, `phone-fullscreen.png`, `phone-dark.png`, `phone-large-text.png`, `phone-quiz.png`, `phone-diagram.png`). They were taken at an overridden 390×844 screen and density 160. Physical arm64 devices, live model output, TalkBack and keyboard/IME behavior have not been verified.

`lintDebug` was attempted and failed with 28 errors, 175 warnings and six hints. All 28 errors were verified on unchanged v0.3.8 source lines. Warnings in new source include the `onTouchEvent`/`performClick` delegate-to-super warning, `SharedPrefsUseKtx` and an unused string. The touch warning has not been established as an accessibility defect; this report does not claim a clean lint run or completed accessibility verification.

## Visual-system handoff

This is an ordinary extension of the incumbent DSH system. `core/designsystem/Color.kt`, `Theme.kt`, `Primitives.kt` and `Content.kt` remain the visual authority. The native gallery and fullscreen view reuse `DshTheme`, `DTopBar`, `DshType` and the existing navigation conventions. `LearningCard.kt` passes resolved native surface, foreground, secondary text, business blue and border colors, including alpha, to `main.tsx`; it also passes font scale and reduced-motion preferences.

The learning stylesheet adds component-local plotting surfaces, feedback colors and controls, using the Android/Roboto family, compact headings, a 20 px card radius and 48 px coarse-pointer controls. These are extension details rather than a replacement token system. Its standalone browser fallback palette and chart/code accent values are not promoted to native system-wide tokens. No `DESIGN.md` or `.impeccable/design.json` is introduced because no new identity or durable system change was approved. Existing Android system typography is retained; web font-detector warnings do not authorize a rebrand.
