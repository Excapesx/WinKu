---
name: WinKu Windows
description: Windows extension of the WinKu Android learning interface
colors:
  primary: "#0b7a40"
  brand: "#0e8a4a"
  background: "#f7f7f9"
  surface: "#fff"
  foreground: "#17171a"
  sidebar: "#eeeef1"
  muted: "#62626c"
  border: "#e4e4ea"
  soft: "#e3f3ea"
  plot: "#fbfbfd"
  grid: "#ececf1"
  success: "#1e7d46"
  error: "#c0392b"
  code: "#f4f4f7"
  dark-primary: "#4fbf86"
  dark-background: "#0e0e10"
  dark-surface: "#17171a"
  dark-foreground: "#f5f5f7"
  dark-sidebar: "#141416"
  dark-muted: "#a3a3ae"
  dark-border: "#2e2e34"
  dark-soft: "#143024"
  dark-plot: "#131316"
  dark-grid: "#24242a"
  dark-success: "#5fc79b"
  dark-error: "#e8797f"
  dark-code: "#141417"
typography:
  welcome:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: "15px"
    lineHeight: 1.6
  answer:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: "15px"
    lineHeight: 1.9
  label:
    fontFamily: '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif'
    fontSize: "13px"
  code:
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, "Roboto Mono", monospace'
    fontSize: ".8125rem"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  field: "10px"
  primary-button: "11px"
  secondary-button: "12px"
  code-block: "16px"
  learning-card: "18px"
  composer: "21px"
spacing:
  compact: "4px"
  related: "8px"
  control: "12px"
  content: "18px"
  section: "24px"
  conversation: "30px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.primary-button}"
    padding: "10px 18px"
  button-text:
    textColor: "{colors.primary}"
    rounded: "{rounded.field}"
    padding: "10px 8px"
  input-provider:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  navigation-row:
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  attachment:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  learning-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.learning-card}"
  composer:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.composer}"
    padding: "14px 14px 8px"
---

# Design System: WinKu Windows

## Overview

**Creative North Star: "WinKu's quiet study workspace"**

This app extends the existing Android learning interface. Neutral grey and chalk surfaces, ink text, the emerald W, and restrained rounded controls remain the visual identity. Windows system typography serves Chinese and English study material, while bundled textbook mathematics and highlighted code retain their own reading conventions. This is an app-scoped record of the implemented Windows extension, not a replacement identity for Android.

The source of truth is `src/style.css`, applied after `../android/learning-ui/src/style.css` by `src/main.tsx`. Shared learning renderers and their mathematics, code and explanation styles are imported through `src/Teaching.tsx`. Product intent is recorded in `../../PRODUCT.md`; this surface's composition is recorded in `SURFACE.md`. The `.review` captures show implemented structure, but captures made before the final action-color adjustment do not supersede current source tokens.

**Key Characteristics:**

- Quiet neutral surfaces with emerald marks and actions.
- Readable Chinese and English text, textbook mathematics, and code.
- Rounded controls and thin separators with restrained functional depth.
- Shared learning components retain their Android visual vocabulary.

## Colors

### Primary

The primary action color is a deeper emerald than the graphic W in light mode. `primary` drives buttons, links, focus indicators, selected learning controls and caret color; `brand` colors the W. Dark mode uses `dark-primary` for both roles. These are the desktop accessibility overrides; shared Android tokens remain unchanged.

**The Action and Mark Rule.** Keep the accessible action emerald separate from the graphic W emerald in light mode; do not substitute the logo color into normal-size action text or filled action controls.

### Neutral

Chalk `background` surrounds white `surface` panels. Ink `foreground` carries reading text, `muted` carries supporting information, `sidebar` separates history, and `border` supplies thin structural dividers. Dark mode swaps the corresponding roles through `data-theme="dark"`; it does not invert images or code mechanically.

`soft` is the pale emerald interaction surface. `plot` and `grid` define graph paper; `code` supports inline code. Success and error colors communicate learning feedback and failures. Shared chart, diagram, explanation and syntax palettes remain scoped to content; they are not additional chrome accents. Their full values stay in the shared renderer styles and components rather than becoming a new desktop palette.

## Typography

Use the Windows system stack in the frontmatter throughout app chrome and prose. It is a deliberate study-reading choice, with Microsoft YaHei UI for Chinese; there is no external display font or marketing type treatment.

The welcome heading uses the `welcome` role, reducing to 28px below the narrow breakpoint. General page headings use `title`; settings uses a 26px variant, and the empty Tools heading uses 23px. Topbar titles stay at body size and medium weight. Supporting labels range from 11px to 14px; they do not compete with explanations.

Assistant messages use the `answer` role, with rendered `.math-text` paragraphs at line-height 1.75. User text uses 15px at line-height 1.85. Markdown heading sizes remain relative to the text through the shared renderer; do not force every generated heading to the page-title size. Equations use bundled KaTeX textbook fonts and preserve complete expressions with horizontal scrolling where necessary. Code uses the mono role, syntax highlighting, and optional wrapping. The shared `.8125rem` code size resolves against the desktop 15px root.

**The Study Reading Rule.** Preserve the separate typography of prose, equations and code instead of flattening all three into app labels.

## Layout

This surface uses a history sidebar (240px) beside a flexible workspace. The topbar is 64px high. The message region scrolls independently; the composer remains at the bottom. The reading column is capped at 760px, the composer at 800px, and the welcome content at 650px. Settings uses a centered reading area around 720px and a form capped at 600px. Common spacing steps are recorded in the frontmatter; conversational messages have more breathing room than utility rows.

At 1050px and below, the sidebar becomes 210px and the optional reader overlays the right side below the topbar. At 800px and below, the sidebar becomes 190px, model shortcuts and keyboard hints simplify, gutters tighten, and the reader becomes `calc(100% - 50px)` of the workspace. The sidebar can collapse to zero width at every size. Long titles truncate; learning content and mathematical blocks handle their own overflow.

This is the current chat surface composition, not a universal layout requirement for every future WinKu surface. The reader only appears after a document is opened. Tools intentionally displays an empty state while its student content is reserved for the user.

## Elevation & Depth

The interface relies mainly on neutral surface changes and thin borders. The composer has only a faint ambient shadow. Shadows establish actual overlays: reader, deletion confirmation, engine requests, expanded learning cards, and status messages. There are no decorative floating card stacks.

The exact shadow values, overlay positions and transitions are recorded in `.impeccable/design.json`. Buttons change background and color over 160ms; sidebar collapse uses a 200ms ease-out curve. Reduced-motion preferences disable transitions and animations. Motion communicates state rather than providing a decorative background.

## Shapes

Controls have restrained rounded corners. Small utility buttons use 9px corners; fields and attachment chips use the `field` radius; primary actions use `primary-button`. Learning shells use `learning-card`, shared code blocks use `code-block`, and the composer uses the larger `composer` curve. User messages have a smaller lower-right corner (5px) within their 18px outline. The circular send control is a functional exception.

The editable identity source is `app-icon.svg`: a rounded chalk square carrying the same rounded-stroke W path used by `Brand` in `src/main.tsx`, inherited from the Android launcher. It is source vector artwork, not an AI-generated image. `src-tauri/icons/icon.ico` and `src-tauri/icons/icon.png` are generated derivatives. The ICO is the bundled Windows icon; the PNG comes from the generated 128×128 export. `src-tauri/icons/README.md` records the Tauri icon generation command and copy destinations. Preserve this provenance when regenerating or shipping those rasters.

## Components

### Buttons

Primary actions are compact filled emerald controls with surface-colored labels, medium weight, 42px minimum height, and the frontmatter padding. Hover darkens by a brightness filter; active uses the inherited foreground fill. Secondary and text actions are transparent, with emerald or muted text according to role. Icon buttons are 36px squares with actual inline SVG icons and accessible names; specialized learning and code controls retain their documented local dimensions. Disabled controls visibly reduce emphasis; disabled send uses explicit neutral colors.

Keyboard focus uses a 2px primary outline with 3px offset on buttons, inputs and selects. The composer groups focus at the container border instead of outlining its textarea separately.

### Inputs / Fields

Provider inputs and selects are surface-colored, thin-bordered controls with 42px minimum height and visible labels above them. Search is intentionally denser. Placeholder and helper text use the muted role. Long values remain within the available width. Checkboxes use the primary accent. Do not use placeholder text as the sole field label.

### Navigation

New chat is a bordered surface button. Sidebar navigation is a quiet row with a 44px minimum height. History rows truncate titles and reveal deletion controls on hover or keyboard focus. Current page selection uses the neutral border surface; history selection also receives the inherited soft interaction surface. Hover and pressed controls use the soft fill. Settings stays at the foot of the sidebar.

### Attachments

Attachment chips combine a small document or image icon with a truncated filename, thin border, surface fill and compact text. Draft attachments add a separate remove action. Opening a chip reveals the reader and a labeled close control; image and extracted text viewing remain in that optional panel.

### Composer

The composer is a large rounded bordered field with a multiline textarea, attachment and model controls, keyboard hint, and circular send or stop action. Its textarea grows from 56px to 180px, then scrolls. Dragging an attachment adds a dashed primary outline and soft background. The note beneath it stays quiet and centered.

### Learning Cards and Reading Content

Learning cards are shared Android shells with thin borders, a title and book icon, content, an expand action, and a footer action to continue the explanation in chat. They persist interaction state per artifact. Desktop expansion uses an inset overlay, closed with the expand control or Escape. Equations, plots, diagrams, tables, quizzes and explanations retain the established shared renderer. Code blocks use their own light and dark syntax palettes, visible copy/wrap controls, and scrollable long lines; these content colors do not redefine navigation.

## Do's and Don'ts

### Do:

- Do preserve the Android neutral/chalk world and emerald W when extending Windows.
- Do use the desktop action token for interactive text, focus and filled actions.
- Do preserve separate reading treatments for prose, mathematics and code.
- Do make keyboard focus and icon-button names visible or accessible as implemented.
- Do keep overlay depth functional and honor reduced-motion preferences.
- Do retain the editable SVG and raster provenance when shipping icons.

### Don't:

- Don't replace the incumbent identity with a new desktop brand or display-font theme.
- Don't promote chart, explanation or syntax colors into general app chrome.
- Don't turn this surface's sidebar/composer composition into a rule for unrelated future screens.
- Don't populate the intentionally empty Tools entry with invented student features.
- Don't use pre-adjustment screenshots as authority for action-color tokens.

