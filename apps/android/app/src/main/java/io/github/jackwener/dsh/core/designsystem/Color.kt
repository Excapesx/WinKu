package io.github.jackwener.dsh.core.designsystem

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// WinKu brand (F2 variant): ONE emerald accent (#0E8A4A) in both themes, on neutral chrome.
// Neutral grey chrome in both modes, so the only hue on screen is the accent.
// Slot names are inherited from the dsh alias palette so every component follows this file.

/** The DSH alias palette. Feature code reads these through [Dsh.colors]; M3 roles are derived from them. */
@Immutable
data class DshColors(
    val isDark: Boolean,
    // labels
    val labelPrimary: Color,
    val labelSecondary: Color,
    val labelTertiary: Color,
    val labelCaption: Color,
    val labelDimmed: Color,
    val labelOnPrimary: Color,
    val labelShimmer: Color,
    val deepDiving: Color,
    val deepDivingShimmer: Color,
    val link: Color,
    val menuIcon: Color,
    // surfaces
    val bgBase: Color,
    val bgLayer1: Color,
    val bgLayer2: Color,
    val bgLayer3: Color,
    val bgModule: Color,
    val bgSkeleton: Color,
    val sidebar: Color,
    val sidebarActive: Color,
    val bubble: Color,
    val inputMajor: Color,
    val selector: Color,
    val codeBlock: Color,
    val codeBanner: Color,
    val inlineCode: Color,
    val menuFill: Color,
    val toastBg: Color,
    // borders
    val borderL1: Color,
    val borderL2: Color,
    val borderL3: Color,
    val borderL4: Color,
    // brand / buttons / interaction
    val brandPrimary: Color,
    val buttonPrimaryDimmed: Color,
    val info: Color,
    val floating: Color,
    val hover: Color,
    val pressed: Color,
    val hoverSolid: Color,
    val hoverDanger: Color,
    val switchThumbOff: Color,
    val business: Color,
    val businessTertiary: Color,
    // status
    val error: Color,
    val errorSecondary: Color,
    val success: Color,
    val successSecondary: Color,
    val successTertiary: Color,
    val warn: Color,
    val warnSecondary: Color,
    val warnLabel: Color,
    val warnTertiary: Color,
    val amber: Color,
    val idle: Color,
    val diffAdded: Color,
    val diffDeleted: Color,
    val scrim: Color,
    // trajectory kinds (dsh context-meter segment colors)
    val kindSystem: Color,
    val kindTools: Color,
    val kindMessages: Color,
)

/** The one brand colour. Identical in light and dark. */
val Brand = Color(0xFF0E8A4A)

val LightDsh = DshColors(
    isDark = false,
    labelPrimary = Color(0xFF17171A), labelSecondary = Color(0xFF55555E), labelTertiary = Color(0xFF6E6E78), labelCaption = Color(0xFF8E8E98),
    labelDimmed = Color(0xFFDEDEE4), labelOnPrimary = Color(0xFFFFFFFF), labelShimmer = Color(0x4D17171A),
    deepDiving = Brand, deepDivingShimmer = Color(0xFF0B6E3B), link = Color(0xFF0B6E3B), menuIcon = Color(0xFF26262B),
    bgBase = Color(0xFFF7F7F9), bgLayer1 = Color(0xFFFFFFFF), bgLayer2 = Color(0xFFFFFFFF), bgLayer3 = Color(0xFFFFFFFF),
    bgModule = Color(0xFFEEEEF2), bgSkeleton = Color(0x0F17171A), sidebar = Color(0xFFF2F2F5), sidebarActive = Color(0xFFE8E8EE),
    bubble = Color(0xFFEEEEF2), inputMajor = Color(0xFFFFFFFF), selector = Color(0xFFEEEEF2),
    codeBlock = Color(0xFFF4F4F7), codeBanner = Color(0xFFEEEEF2), inlineCode = Color(0xFFF1F1F5), menuFill = Color(0xF0F7F7F9),
    toastBg = Color(0xFF1F1F23),
    borderL1 = Color(0x0F17171A), borderL2 = Color(0x1A17171A), borderL3 = Color(0x2417171A), borderL4 = Color(0x3317171A),
    brandPrimary = Color(0xFF17171A), buttonPrimaryDimmed = Color(0xFFDEDEE4), info = Brand, floating = Color(0xFFFFFFFF),
    hover = Color(0x1417171A), pressed = Color(0x1F17171A), hoverSolid = Color(0xFFF0F0F4), hoverDanger = Color(0x0FC0392B),
    switchThumbOff = Color(0xFFFFFFFF), business = Brand, businessTertiary = Color(0xFFE3F3EA),
    error = Color(0xFFC0392B), errorSecondary = Color(0xFFD4584A), success = Color(0xFF1E7D46), successSecondary = Color(0xFF3E9A63),
    successTertiary = Color(0xFFE1F0E8), warn = Color(0xFFA56A08), warnSecondary = Color(0xFFC08A2E), warnLabel = Color(0xFFA56A08),
    warnTertiary = Color(0xFFF7EDDA), amber = Color(0xFFC08A2E), idle = Color(0xFFC9C9D2),
    diffAdded = Color(0x141E7D46), diffDeleted = Color(0x14C0392B), scrim = Color(0x3D0E0E10),
    kindSystem = Color(0xFF8E8E98), kindTools = Color(0xFF3E9A63), kindMessages = Brand,
)

val DarkDsh = DshColors(
    isDark = true,
    labelPrimary = Color(0xFFF5F5F7), labelSecondary = Color(0xFFB4B4BE), labelTertiary = Color(0xFF8A8A94), labelCaption = Color(0xFF6E6E78),
    labelDimmed = Color(0xFF2E2E34), labelOnPrimary = Color(0xFF0E0E10), labelShimmer = Color(0x73FFFFFF),
    deepDiving = Brand, deepDivingShimmer = Color(0xFF4FBF86), link = Color(0xFF4FBF86), menuIcon = Color(0xFFDCDCE2),
    bgBase = Color(0xFF0E0E10), bgLayer1 = Color(0xFF17171A), bgLayer2 = Color(0xFF1C1C20), bgLayer3 = Color(0xFF242429),
    bgModule = Color(0xFF242429), bgSkeleton = Color(0x14FFFFFF), sidebar = Color(0xFF121214), sidebarActive = Color(0xFF242429),
    bubble = Color(0xFF1C1C20), inputMajor = Color(0xFF17171A), selector = Color(0xFF242429),
    codeBlock = Color(0xFF0A0A0C), codeBanner = Color(0xFF17171A), inlineCode = Color(0xFF141417), menuFill = Color(0xF017171A),
    toastBg = Color(0xFF242429),
    borderL1 = Color(0x0FFFFFFF), borderL2 = Color(0x1AFFFFFF), borderL3 = Color(0x24FFFFFF), borderL4 = Color(0x33FFFFFF),
    brandPrimary = Color(0xFFF5F5F7), buttonPrimaryDimmed = Color(0xFF2E2E34), info = Brand, floating = Color(0xFF1C1C20),
    hover = Color(0x14FFFFFF), pressed = Color(0x24FFFFFF), hoverSolid = Color(0xFF242429), hoverDanger = Color(0x26E8797F),
    switchThumbOff = Color(0xFF8A8A94), business = Brand, businessTertiary = Color(0xFF10301F),
    error = Color(0xFFE8797F), errorSecondary = Color(0xFFF09AA0), success = Color(0xFF5FC79B), successSecondary = Color(0xFF83D9B2),
    successTertiary = Color(0xFF123024), warn = Color(0xFFE5B45C), warnSecondary = Color(0xFFF0C97F), warnLabel = Color(0xFFE5B45C),
    warnTertiary = Color(0xFF302613), amber = Color(0xFFE5B45C), idle = Color(0xFF3A3A44),
    diffAdded = Color(0x1F5FC79B), diffDeleted = Color(0x1FE8797F), scrim = Color(0x80000000),
    kindSystem = Color(0xFF8A8A94), kindTools = Color(0xFF5FC79B), kindMessages = Brand,
)

internal fun schemeOf(c: DshColors) = if (c.isDark) darkColorScheme(
    primary = c.brandPrimary, onPrimary = c.labelOnPrimary, primaryContainer = c.buttonPrimaryDimmed, onPrimaryContainer = c.labelPrimary,
    secondary = c.business, onSecondary = c.labelOnPrimary, secondaryContainer = c.businessTertiary, onSecondaryContainer = c.labelPrimary,
    tertiary = Brand, background = c.bgBase, onBackground = c.labelPrimary, surface = c.bgBase, onSurface = c.labelPrimary,
    onSurfaceVariant = c.labelSecondary, surfaceDim = c.sidebar, surfaceContainerLowest = c.bgBase, surfaceContainerLow = c.bgLayer1,
    surfaceContainer = c.bgLayer2, surfaceContainerHigh = c.bgLayer3, surfaceContainerHighest = c.bgModule, surfaceVariant = c.hoverSolid,
    inverseSurface = c.toastBg, inverseOnSurface = Color.White, inversePrimary = Brand, outline = c.borderL4, outlineVariant = c.borderL2,
    error = c.error, onError = c.labelOnPrimary, errorContainer = Color(0xFF3A1A1D), onErrorContainer = Color(0xFFF6DDE0), scrim = c.scrim,
    surfaceTint = Color.Transparent,
) else lightColorScheme(
    primary = c.brandPrimary, onPrimary = c.labelOnPrimary, primaryContainer = c.buttonPrimaryDimmed, onPrimaryContainer = c.labelPrimary,
    secondary = c.business, onSecondary = Color.White, secondaryContainer = c.businessTertiary, onSecondaryContainer = Color(0xFF17171A),
    tertiary = Brand, background = c.bgBase, onBackground = c.labelPrimary, surface = c.bgBase, onSurface = c.labelPrimary,
    onSurfaceVariant = c.labelSecondary, surfaceDim = c.sidebar, surfaceContainerLowest = c.bgBase, surfaceContainerLow = c.bgLayer1,
    surfaceContainer = c.bgLayer2, surfaceContainerHigh = c.bgLayer3, surfaceContainerHighest = c.bgModule, surfaceVariant = c.hoverSolid,
    inverseSurface = c.toastBg, inverseOnSurface = Color.White, inversePrimary = Brand, outline = c.borderL4, outlineVariant = c.borderL2,
    error = c.error, onError = Color.White, errorContainer = Color(0xFFF7E0E0), onErrorContainer = Color(0xFF6B1F22), scrim = c.scrim,
    surfaceTint = Color.Transparent,
)

val LocalDshColors = staticCompositionLocalOf { LightDsh }
