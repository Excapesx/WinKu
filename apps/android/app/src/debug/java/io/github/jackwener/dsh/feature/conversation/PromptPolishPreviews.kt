package io.github.jackwener.dsh.feature.conversation

import android.content.res.Configuration
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import androidx.compose.ui.unit.dp
import io.github.jackwener.dsh.core.designsystem.DshTheme
import io.github.jackwener.dsh.core.model.PermissionPreset
import io.github.jackwener.dsh.core.provider.CUSTOM
import io.github.jackwener.dsh.core.provider.ModelChoice
import io.github.jackwener.dsh.core.provider.ProviderConfig

class PolishPreviewStates : PreviewParameterProvider<String> {
    override val values = sequenceOf("idle", "busy", "done")
}

/** Actual composer states, no model requests or engine required. */
@Preview(name = "提示词润色·浅色", widthDp = 390, locale = "zh-rCN")
@Preview(name = "提示词润色·深色", widthDp = 390, locale = "zh-rCN", uiMode = Configuration.UI_MODE_NIGHT_YES)
@Preview(name = "提示词润色·窄屏大字", widthDp = 320, locale = "zh-rCN", fontScale = 1.3f)
@Composable
private fun PromptPolishPreview(@PreviewParameter(PolishPreviewStates::class) phase: String) {
    val state = remember(phase) {
        ComposerState().apply {
            text = "帮我整理校园读书分享会的活动方案，保留预算和待确认事项。"
            if (phase == "busy") polish = polish.begin()
            if (phase == "done") polish = polish.copy(original = "帮我写个读书会策划", result = text)
        }
    }
    val provider = ProviderConfig("preview", CUSTOM, "Preview", "https://example.com/v1", listOf("example-model"))
    DshTheme {
        Column(Modifier.padding(8.dp)) {
            Composer(state = state, running = false, preset = PermissionPreset.Ask, onPreset = {},
                model = ModelChoice(provider, "example-model"), providers = listOf(provider), onModel = { _, _ -> },
                contextTokens = 0, onSend = {}, onStop = {})
        }
    }
}
