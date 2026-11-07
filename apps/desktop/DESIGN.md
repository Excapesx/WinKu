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
typography:
  welcome:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.02em
  title:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 25px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.02em
  body:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 16px
    lineHeight: 1.6
  answer:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 15px
    lineHeight: 26px
  user:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 14px
    lineHeight: 22px
  composer:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 16px
    lineHeight: 24px
  brand:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 18px
    fontWeight: 600
  label:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: 13px
  learning-title:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
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
  field: 10px
  primary-button: 11px
  secondary-button: 12px
  code-block: 16px
  learning-card: 20px
  user-bubble: 20px
  composer: 28px
spacing:
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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: 9px 12px
  navigation-row:
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: 11px 12px
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
    padding: 8px 8px 6px
  user-bubble:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.user-bubble}"
    padding: 10px 16px
---

# Design System: WinKu Windows

## Overview

**Creative North Star: "WinKu's quiet study workspace"**

This app extends the existing Android learning interface. Neutral grey and chalk surfaces, ink text, the emerald W, and restrained rounded controls remain the visual identity. Windows system typography serves Chinese and English study material, while bundled textbook mathematics and highlighted code retain their own reading conventions. This is an app-scoped record of the implemented Windows extension, not a replacement identity for Android.

Android is the visual authority for this unified surface. `scripts/sync-android-design.mjs` generates `src/android-design.css` from Android `Color.kt`, `src/android-brand.ts` from `brand_mark.xml`, and `app-icon.svg` from the launcher vector and launcher background. `src/main.tsx` loads shared learning styles, desktop layout styles, then the generated Android roles. The frontmatter mirrors these scoped runtime values; update the Android source and generator when changing shared roles rather than treating a documentation snapshot as an independent theme. `SURFACE.md` records the Windows composition; `../../PRODUCT.md` remains the product context.

**Key Characteristics:**

- Quiet neutral surfaces with emerald identity and content accents.
- Android-derived colors, marks, bubbles and composer with Windows study typography.
- Readable Chinese and English text, textbook mathematics, and code.
- Shared learning components retain their Android visual vocabulary.

## Colors

### Primary

The W and business accent retain Android emerald in both themes. Chrome links and focus use the readable link role: light `primary` and `dark-primary`. Settings/setup primary buttons use the neutral `action-fill` with `on-action`; the circular send control uses `accent` and a white arrow. These are different roles. The previous desktop-only emerald action override is superseded by the generated Android mapping.

**The Android Role Rule.** Preserve the distinct Android roles for neutral primary buttons, readable links, business accents and the W mark. Learning content has its own scoped role overrides; do not flatten those scopes into one global primary color.

### Neutral

Chalk `background` surrounds layered `surface` content. `foreground` and `muted` come from Android label roles. Sidebar, selected history, user bubbles, composer, selectors, hover and borders each have their own Android role rather than reusing one panel gray. Corresponding dark roles switch through `data-theme="dark"`. The frontmatter records alpha borders and hover values as used, without converting them to opaque approximations.

Inside `.learning-content`, surface becomes Android base background, muted becomes label-secondary, primary becomes business emerald, and the border uses Android border-L2. Shared renderer soft and code defaults are restored within that scope. Consequently, a learning action or card is not a settings button or a raised chrome panel. Success and error retain their feedback roles; chart, diagram, explanation and syntax palettes remain scoped to content in the shared renderer.

## Typography

Use the Windows system stack in the frontmatter throughout app chrome and prose, with Microsoft YaHei UI for Chinese. The chrome root is 16px. The sidebar wordmark uses 18px semibold, its W is 22px, and its AGENT label is 11px with quiet tracking. The centered empty-chat greeting is 26px medium with a 34px W. General page headings use the title role; settings uses 26px and the empty Tools heading 23px. Topbar titles remain 15px medium. Supporting labels range from 11px to 14px.

User messages use 14px/22px. Assistant messages omit the former repeated WinKu brand row and read at 15px/26px. The shared text-document and math renderer preserve Android's own prose rhythm, relative markdown headings, textbook KaTeX fonts, and scrolling for complete expressions. Composer text uses 16px/24px. Learning content establishes a 16px root; card titles use 17px/25.5px with normal tracking and may contain rendered formulas. Shared code remains .8125rem (13px with the current root), its mono stack, syntax highlighting and optional wrapping.

**The Study Reading Rule.** Preserve the separate typography of prose, equations and code instead of flattening all three into app labels.

## Layout

The Windows surface retains a history sidebar (240px) beside a flexible workspace, a 64px topbar, a reading column capped at 760px, and a composer capped at 800px. During a conversation, messages scroll independently while the composer remains below them. The workspace uses overflow clipping so content focus or scrolling cannot move the header or composer outside the window. An empty conversation instead centers the W, “今天想做点什么” and composer together. The missing-provider setup action remains available; there is no recommended-question list.

At 1050px and below, the sidebar becomes 210px and the optional reader overlays the right side below the topbar. At 800px and below, the sidebar becomes 190px, model shortcuts and keyboard hints simplify, gutters tighten, and the reader becomes `calc(100% - 50px)` of the workspace. The sidebar can collapse to zero width at every size. Long titles truncate; learning content and mathematical blocks handle their own overflow. Settings keeps its centered area around 720px and form capped at 600px.

These are the current chat surface's Windows adaptations, alongside file drag-and-drop, keyboard controls and inset large-screen expansion. They are not universal composition requirements for every future WinKu surface. The reader appears only after a document is opened. Tools intentionally displays an empty state while its student content is reserved for the user.

## Elevation & Depth

Neutral surface changes and thin borders carry most depth. The composer has a faint ambient shadow. Shadows establish actual overlays: reader, deletion confirmation, engine requests, expanded learning cards and status messages. Exact values, transition timing and breakpoints are in `.impeccable/design.json`. Buttons change background and color over 160ms; sidebar collapse uses a 200ms ease-out curve. Reduced-motion preferences disable transitions and animations.

## Shapes

Controls retain restrained rounded corners. Utility buttons use 9px corners; fields and attachment chips use the field radius; settings primary actions use the primary-button radius. User bubbles are uniformly rounded at 20px, without a pointed corner, and align right with an 82% maximum width. Learning shells are 20px; code blocks retain their shared 16px corners. The composer is 28px, with circular attachment and send controls.

Launcher and in-app marks have separate Android sources and purposes. `app-icon.svg` is generated from `res/drawable/ic_launcher_fg.xml` and the dark launcher background in `res/values/colors.xml`; Windows wraps the Android launcher geometry in a rounded square. The in-app W comes from `res/drawable/brand_mark.xml`, exported to `src/android-brand.ts`, rather than cropping the launcher artwork. Both retain the Android emerald. These are source vector assets, not AI-generated illustrations.

`src-tauri/icons/icon.ico` and `src-tauri/icons/icon.png` are generated derivatives of `app-icon.svg`; the PNG is the 128×128 export. `src-tauri/icons/README.md` records the Tauri generation command and copy destinations. Packaging synchronizes the Android design and regenerates icons. Preserve this lineage when shipping rasters.

## Components

### Buttons

Settings/setup primary actions are neutral filled controls with on-action labels, medium weight and a 42px minimum height. Text actions use the readable chrome link role. New chat uses a neutral hover-solid fill and a 16px message-plus icon. Chrome utility buttons are 36px squares with inline SVG icons and accessible names. Hover uses the Android hover overlay; selected navigation uses sidebar-active rather than emerald. Disabled controls visibly reduce emphasis.

Learning buttons retain the shared 48px minimum size, 14px primary-action corners and business emerald. Their icon controls are 48px with 20px icons. Keyboard focus uses a 2px primary outline with 3px offset; the composer groups focus at its container border.

### Inputs / Fields

Provider inputs and selects use surface fill, thin borders, visible labels, 42px minimum height and the field radius. Search remains denser. Placeholder and helper text use the muted role. Long values stay within available width. Checkboxes use the chrome link accent. Do not use placeholders as the sole field label.

### Navigation

Sidebar navigation has a 44px minimum height and 14px labels. New chat is centered in a neutral rounded button. History rows truncate titles, reveal deletion on hover or keyboard focus, and use the dedicated selected-history background. Settings remains at the foot of the sidebar. The WinKu AGENT heading inherits the Android in-app mark and wordmark proportions.

### Attachments

Compact chips combine a document/image icon, truncated filename, thin border and surface fill. Draft attachments add a remove action. The composer exposes attachment through a small 28px circular plus control with an 18px icon. Opening a source reveals the optional reader and its labeled close action; image and extracted-text viewing stay in that panel.

### Composer

The Android-shaped composer uses its dedicated input-major fill, thin border, 28px radius and compact padding. Its multiline textarea grows from 56px to 180px, then scrolls. A small plus button, model selector and circular emerald send action form the lower toolbar, with a Windows keyboard hint where space allows. Stop uses the foreground role. Disabled send retains emerald at reduced opacity. Dragging adds a dashed link-color outline and soft background. The note beneath remains quiet and centered.

### Learning Cards and Reading Content

Learning bodies directly reuse Android's function plot, chart, diagram, quiz, formula, code, table, HTML, markdown and explanation components. A type-specific icon and formula-aware title replace the former generic book heading. The shell uses the Android base surface and role overrides, 20px radius and shared footer follow-up action. Interaction state persists per artifact.

Desktop expansion uses an inset dialog with 48px controls, Escape dismissal, a keyboard focus loop and focus restoration. Equations, highlighted code, tables and interactions retain the shared Android rendering rather than desktop-specific visual replacements. Code blocks keep their own syntax palettes and copy/wrap controls. Shared content colors do not redefine navigation.

## Do's and Don'ts

### Do:

- Do preserve the Android neutral/chalk world and emerald W when extending Windows.
- Do synchronize shared colors and marks from their Android sources.
- Do preserve separate reading treatments for prose, mathematics and code.
- Do make keyboard focus and icon-button names visible or accessible as implemented.
- Do keep overlay depth functional and honor reduced-motion preferences.
- Do retain the editable SVG and raster provenance when shipping icons.

### Don't:

- Don't replace the incumbent identity with a new desktop brand or display-font theme.
- Don't promote chart, explanation or syntax colors into general app chrome.
- Don't collapse chrome and learning-content color scopes into a single action palette.
- Don't turn this surface's sidebar/composer composition into a rule for unrelated future screens.
- Don't populate the intentionally empty Tools entry with invented student features.
- Don't use earlier pre-unification screenshots as authority for current tokens.
