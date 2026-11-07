---
name: WinKu Windows
description: Windows extension unified with the WinKu Android interface
colors:
  background: "#f7f7f9"
  surface: "#ffffff"
  foreground: "#17171a"
  muted: "#55555e"
  sidebar: "#f2f2f5"
  sidebar-active: "#e8e8ee"
  bubble: "#eeeef2"
  composer: "#ffffff"
  selector: "#eeeef2"
  border: "#17171a1a"
  hover: "#17171a14"
  hover-solid: "#f0f0f4"
  primary: "#0b6e3b"
  brand: "#0e8a4a"
  accent: "#0e8a4a"
  action-fill: "#17171a"
  on-action: "#ffffff"
  disabled-fill: "#dedee4"
  soft: "#e3f3ea"
  error: "#c0392b"
  success: "#1e7d46"
  code: "#f1f1f5"
  learning-surface: "#f7f7f9"
  learning-foreground: "#17171a"
  learning-muted: "#55555e"
  learning-primary: "#0e8a4a"
  learning-border: "#17171a1a"
  learning-soft: "#e3f3ea"
  learning-code: "#f4f4f7"
  dark-background: "#0e0e10"
  dark-surface: "#17171a"
  dark-foreground: "#f5f5f7"
  dark-muted: "#b4b4be"
  dark-sidebar: "#121214"
  dark-sidebar-active: "#242429"
  dark-bubble: "#1c1c20"
  dark-composer: "#17171a"
  dark-selector: "#242429"
  dark-border: "#ffffff1a"
  dark-hover: "#ffffff14"
  dark-hover-solid: "#242429"
  dark-primary: "#4fbf86"
  dark-brand: "#0e8a4a"
  dark-accent: "#0e8a4a"
  dark-action-fill: "#f5f5f7"
  dark-on-action: "#0e0e10"
  dark-disabled-fill: "#2e2e34"
  dark-soft: "#10301f"
  dark-error: "#e8797f"
  dark-success: "#5fc79b"
  dark-code: "#141417"
  dark-learning-surface: "#0e0e10"
  dark-learning-foreground: "#f5f5f7"
  dark-learning-muted: "#b4b4be"
  dark-learning-primary: "#0e8a4a"
  dark-learning-border: "#ffffff1a"
  dark-learning-soft: "#143024"
  dark-learning-code: "#141417"
  permission-read-only: "#b68a36"
  permission-read-only-soft: "#b68a361b"
  dialog-scrim: "#0007"
  switch-thumb: "#ffffff"
typography:
  timestamp:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 10px
    lineHeight: 1.6
  micro:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 11px
    lineHeight: 17px
  helper:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 12px
    lineHeight: 21px
  dialog-title:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 20px
    lineHeight: 1.6
  stat:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 24px
    lineHeight: 1.6
  empty-title:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 23px
    lineHeight: 1.4
  welcome:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: normal
  title:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 16px
    lineHeight: 1.6
  answer:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 15px
    lineHeight: 26px
  user:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 14px
    lineHeight: 22px
  composer:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 16px
    lineHeight: 24px
  brand:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 18px
    fontWeight: 600
  label:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 13px
  learning-title:
    fontFamily: 'WinKuSans, "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: normal
  code:
    fontFamily: ui-monospace, "Cascadia Code", Consolas, "Roboto Mono", monospace
    fontSize: .8125rem
    fontWeight: 400
    lineHeight: 1.8
rounded:
  icon: 8px
  menu-item: 9px
  menu: 14px
  dialog-action: 18px
  outline-button: 22px
  dialog: 24px
  circle: 50%
  field: 10px
  primary-button: 11px
  secondary-button: 12px
  code-block: 16px
  learning-card: 20px
  user-bubble: 20px
  composer: 28px
spacing:
  tight: 6px
  inline: 10px
  composer-inset: 14px
  row-inset: 16px
  group: 20px
  compact: 4px
  related: 8px
  control: 12px
  content: 18px
  section: 24px
  conversation: 30px
components:
  button-primary:
    backgroundColor: "{colors.action-fill}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.primary-button}"
    padding: 10px 18px
  button-text:
    textColor: "{colors.primary}"
    rounded: "{rounded.field}"
    padding: 10px 8px
  input-provider:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: 9px 12px
  navigation-row:
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: 0 10px
    height: 44px
  attachment:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: 10px 12px
  learning-card:
    backgroundColor: "{colors.learning-surface}"
    rounded: "{rounded.learning-card}"
  composer:
    backgroundColor: "{colors.composer}"
    rounded: "{rounded.composer}"
    padding: 14px 14px 10px
  settings-card:
    backgroundColor: "{colors.bubble}"
    rounded: "{rounded.learning-card}"
  switch-on:
    backgroundColor: "{colors.brand}"
    width: 36px
    height: 20px
    rounded: "{rounded.field}"
  switch-off:
    backgroundColor: "{colors.disabled-fill}"
    width: 36px
    height: 20px
    rounded: "{rounded.field}"
  risk-dialog:
    backgroundColor: "{colors.bubble}"
    rounded: "{rounded.dialog}"
    padding: 24px
  permission-chip:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.icon}"
    height: 30px
    padding: 0 7px
  user-bubble:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.user-bubble}"
    padding: 10px 16px
---

# Design System: WinKu Windows

## Overview

**Creative North Star: "WinKu's quiet study workspace"**

This app extends WinKu's established Android learning interface: neutral grey and chalk surfaces, ink text, an emerald W, rounded groups and a conversation-first hierarchy. Locally bundled Noto Sans SC gives Chinese and Latin interface text a consistent sans-serif voice. Shared learning content keeps its separate mathematics, code and content-color conventions. This is an app-scoped implementation record, preserving the Android identity.

Android is the visual authority. `scripts/sync-android-design.mjs` generates Android colors, in-app mark, launcher artwork, icon paths and provider presets. Styles load shared learning CSS, desktop CSS, generated Android roles, then `mobile-parity.css`. The final layer supplies the current font and Android-shaped controls. `MobileUI.tsx` supplies repeated controls and `MobilePages.tsx` settings pages. `SURFACE.md` records the Windows composition; `../../PRODUCT.md` remains product context.

This record captures implemented Windows adaptations within the incumbent Android world; the independent scoped verdict has resolved all six listed fixes; this is not exhaustive release approval. Plugins / Skills / MCP management, skill imports, authenticated MCP configuration, the system / Chinese / English UI catalog, durable busy-send queue and SDK steering are implemented. A separate read-only discovered-skill inventory refreshes the actual registry snapshot, shows source/provider/path and incomplete-result hints, and limits custom directories to the isolated workspace `.agents/skills` and `.dsh/skills`. This establishes tested portable management flows, not exhaustive Android parity or nearly identical behavior on every subpage. Upstream Web-only optional bundles are not exposed as working desktop controls.

**Key Characteristics:**

- Quiet neutral surfaces with emerald identity and content accents.
- Android-derived colors, marks, icons, grouped settings and composer.
- Bundled Chinese and Latin sans text, textbook mathematics and code.
- Shared learning components retain their Android visual vocabulary.

## Colors

### Primary

The W, send button, prompt-polish wand and enabled switch use Android brand emerald in both themes. Chrome links and focus use the readable primary role, which lightens in dark mode. Settings primary actions use the neutral action-fill/on-action pair. Permission chips distinguish amber read-only, primary/soft ask, and error-color full access with a translucent error fill.

**The Android Role Rule.** Preserve separate roles for neutral primary actions, readable chrome links, business accents and the W mark. Learning content keeps its scoped role overrides; do not flatten every scope into one primary color.

### Neutral

Chalk background, raised surface, sidebar, selected history, bubble, composer and selector remain separate Android roles. Thin alpha borders and hover overlays preserve their tonal differences. Dark roles activate through `data-theme="dark"`. The frontmatter records generated runtime colors; shared-role changes belong in Android sources and the generator.

Within learning content, surface becomes Android base background and primary becomes business emerald. Muted, border, soft and code use the scoped generated learning overrides. Shared plot/chart/diagram/explanation and syntax palettes remain local to the renderer. Success/error convey feedback; scrim and white switch thumb are intentional control colors. Shadow colors are recorded in the sidecar.

## Typography

`mobile-parity.css` defines WinKuSans as unchanged Noto Sans SC, using the fallback stack in the frontmatter, weight range 100–900 and font-display swap. `src/fonts/NotoSansSC.ttf` is 17,772,300 bytes (about 17 MiB). `src/fonts/README.md` records its Google Fonts origin and `OFL.txt` contains SIL Open Font License 1.1; the packaging license record includes it. Preserve the font and license together.

The root is 16px. The centered greeting is medium weight with normal tracking; the sidebar wordmark is 18px semibold and its AGENT label 11px with quiet tracking. Navigation uses 15px; history and settings rows use 14px; group labels use 13px; helper notes 12px; microcopy 11px; timestamps/composer notes 10px. Settings topbar titles use 16px semibold, dialogs 20px and statistics 24px. The inherited empty Tools title remains 23px. Other inherited headings retain their existing 25px default where used.

User messages use 14px/22px, assistant answers 15px/26px and composer text 16px/24px. Shared learning content establishes a 16px root with normal-tracked 17px titles. KaTeX retains bundled textbook fonts; code keeps its .8125rem mono treatment, syntax highlighting and optional wrapping. These content treatments remain distinct from app labels.

**The Study Reading Rule.** Preserve the separate typography of prose, equations and code instead of flattening study material into interface labels.

## Layout

The current history sidebar is 300px beside a flexible workspace. Brand/header rows and page topbars are 56px tall. Message column, composer and settings inner page are capped at 800px. Messages scroll independently above the composer; an empty conversation centers the W and greeting immediately above it. The initial viewport no longer has a large provider-setup panel. Tools remains empty pending user-specified student contents.

The rail becomes 280px at 1000px and below, then 260px at 760px and below; collapse takes it to zero. Composer gutters reduce from 24px to 14px at the first breakpoint, toolbar gaps tighten and model labels truncate. The minimum-window contract is 760px. Settings pages have an independent scrolling region, stable scrollbar gutter and 16px side insets, reducing to 10px at the narrow breakpoint. Grouped rows use 16px insets and at least 48px height.

The optional reader retains inherited overlay breakpoints at 1050px and 800px. Its source still specifies a 64px top offset while the current topbar is 56px; this remaining inherited alignment is not an intentional topbar token. Shared math, tables and code handle their own overflow. These measurements describe this surface rather than all future WinKu pages.

## Elevation & Depth

Depth is mainly tonal and bordered. The current composer explicitly has no shadow. Menus, dialogs, expanded learning content, reader overlays, engine requests and status messages use functional shadows, with exact values in the sidecar. Ordinary settings groups stay flat. Dialogs use a dark scrim. Shared button transitions are 160ms, switch translation is 160ms ease-out and sidebar collapse is 200ms with an ease-out curve. The reduced-motion rule removes transitions, animations and smooth scrolling.

## Shapes

Settings groups, learning shells and uniform user bubbles use R20; the composer uses R28 and circular utility/send controls. Contextual radii for fields, menus, outlined pill actions and dialogs are recorded in the frontmatter. Switches use a filled 36×20 track and 16px white thumb, translated 16px when on. A pseudo-element expands the pointer hit area without enlarging the visible track.

`AIcon` renders generated Android vector paths with their original viewboxes, fill/stroke treatment and line weight. Row icons are 20px and utility controls normally use 18px art inside 32px buttons. Mode icon choices use circular 36px cells. Preserve these source vectors instead of substituting decorative glyphs.

Launcher and in-app marks have separate Android sources. Launcher foreground/background generate `app-icon.svg`; `brand_mark.xml` generates `android-brand.ts`. Tauri ICO and 128×128 PNG files derive from the launcher SVG; `src-tauri/icons/README.md` records the lineage. Packaging synchronizes Android design and regenerates icons. Preserve raster and font provenance.

## Components

### Buttons and Navigation

Settings save actions use the neutral action pair, 42px minimum height and compact padding. Text actions use readable primary; outlined actions use thin borders and pill geometry. Shared learning actions retain their business-emerald scope, 48px minimum height and contextual corners. Keyboard focus uses the primary outline: 2px offset on Android utility/menu controls and 3px on inherited buttons.

The sidebar contains centered new chat, plain Tools/Automation/Permissions, history and bottom Settings. Navigation rows are 44px tall with 15px text, quiet Android vectors and neutral selected-history fill. History titles truncate; search/filter, timestamps and overflow support its Android-derived flow. Menus have tonal fill, thin borders, bounded width, scrolling and keyboard navigation.

### Grouped Settings and Fields

The index retains interactive learning, General, Model service, Abilities, Extensions, Session modes, Usage, Computer permissions and About in Android order. Every page has a back destination. R20 groups use bubble fill, thin perimeter borders and inset internal dividers. Rows pair a label with optional muted detail and a trailing control/chevron. When a row has both navigation and a switch, its label button and switch are siblings; never nest one button inside another. Secondary page actions reuse the shared outlined pill button (`a-outline-button`). Fields use background fill, thin borders, R10 corners, visible labels and at least 40px height; prompt textareas grow vertically.

Provider presets and icons come from generated Android sources. Presets seed setup fields while actual model availability comes from the provider. Current discovery/test/edit/delete and Windows credential storage are implemented adaptations, not evidence of exhaustive provider-flow equivalence.

### Extensions and Language

Extensions retains Plugins / Skills / MCP tabs and nested list, detail, import and marketplace/index routes within the existing grouped settings vocabulary. Native dsh plugin management exposes actionable profile/removable packages, filtering core and upstream Web-only optional bundles. Index controls support refresh, editing the index URL and exact-version installation. Index parsing and installation were verified against a local HTTP index; the curated jsDelivr endpoint was unreachable in this environment, so live external marketplace access is not verified. Network failures use translated, actionable copy.

Skills import from ZIP, URL or GitHub with their assets. MCP editors support headers and environment variables backed by Windows Credential Manager, connection testing, discovered tools and ask controls. Native credential save/reload and an authenticated MCP probe passed against a local server; secrets remain outside plain desktop configuration. These Windows adaptations passed the scoped six-fix review.

General settings exposes System / Chinese / English language choices. The UI catalog resolves system language, updates the document language and translates interface labels and feedback. Keep user content, package names and protocol identifiers intact.

### Switches and Segmented Controls

The final switch override uses brand track/white thumb when on and disabled-fill track/white thumb when off. It exposes switch semantics, label, checked state and disabled treatment. Segmented choices use neutral selector fill with a surface-colored selected segment; task filters use outlined pills. Preserve state distinction across themes.

### Composer

The bordered R28 composer uses the documented inset and no ambient shadow. The draft initially has 68px minimum height before inherited maximum-height scrolling. Toolbar controls include attachment, permission, mode, working brand-emerald polish/undo, model, supported effort, Windows voice entry and send/stop. Attachment is 30px; send is 36px. Chips communicate read-only/ask/full. Model names truncate and essential actions stay visible at the narrow contract. Busy-send settings choose a durable queue or real SDK steering. The queue appears above the composer in a surface-filled, thin-bordered R16 dock, with a 180px maximum height and internal scrolling; 40px rows truncate message labels beside their actions. Queued messages survive persistence, and steering uses the active SDK session. The selected mode is bound to the session.

### Dialogs and Mode Editor

Dialogs use R24 tonal panels, dark scrim, internal scrolling, Escape dismissal, focus containment and focus restoration. Current `RiskDialog` starts unchecked and disables confirmation until acknowledgement; it guards confirmation for 300ms after opening. Composer, general access settings and the mode full-access preset share this pattern.

The current mode editor includes name, Android icon choice, prompt, inherited/read-only/ask/full preset, Windows capability groups, engine-tool toggles, skill inclusion, duplication and built-in read-only treatment. Mode settings have real runtime effects in engine/client paths, and a mode cannot raise general permissions. The selected mode is bound to the session. The independent scoped verdict resolved the listed mode, acknowledgement and switch fixes.

### Learning Cards and Reading Content

Learning bodies directly reuse Android function plots, charts, diagrams, quizzes, formulas, code, tables, HTML, markdown and explanations. Type-specific icons, formula-aware titles, scoped base surfaces and footer follow-ups preserve the shared vocabulary. Artifact state persists. Desktop expansion uses an inset dialog and shared renderer. Code copy/wrap, equation overflow and content colors stay local. Attachment filename chips open optional source readers.

Reported validation for this implementation: 19 serial tests, TypeScript checks, frontend build and debug Rust checks passed. Actual isolated Tauri screenshots are recorded under `.review/completion-*.png`. The independent verdict resolved all six scored fixes; the scope and external-market limits remain.

**The Current Evidence Rule.** Document implemented portable flows and review limits separately; a documentation refresh does not establish exhaustive Android parity or release approval.

## Do's and Don'ts

### Do:

- Do preserve the Android neutral/chalk world and emerald W when extending Windows.
- Do synchronize shared colors, marks, icons and provider presets from Android sources.
- Do use bundled WinKuSans for interface text and preserve separate prose, mathematics and code treatments.
- Do retain R20 groups, the R28 composer and the compact Android switch geometry.
- Do preserve keyboard focus, accessible names, acknowledgement gates and reduced-motion behavior.
- Do retain vector, raster and bundled-font provenance when shipping.

### Don't:

- Don't replace the incumbent identity with a new desktop brand or display-font theme.
- Don't promote chart, explanation or syntax colors into general app chrome.
- Don't collapse chrome and learning-content scopes into one action palette.
- Don't turn this sidebar/composer arrangement into a universal composition rule.
- Don't populate the reserved Tools entry with invented student features.
- Don't claim release approval, exhaustive Android parity or live external marketplace verification from this documentation refresh.
