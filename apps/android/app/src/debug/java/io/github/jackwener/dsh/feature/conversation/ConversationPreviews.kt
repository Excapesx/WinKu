package io.github.jackwener.dsh.feature.conversation

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import io.github.jackwener.dsh.core.data.WorkDetails
import io.github.jackwener.dsh.core.designsystem.DTopBar
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshTheme
import io.github.jackwener.dsh.core.designsystem.LocalReducedMotion
import io.github.jackwener.dsh.core.session.Block
import io.github.jackwener.dsh.core.session.Conversation
import io.github.jackwener.dsh.core.session.SessionLive
import io.github.jackwener.dsh.core.session.Turn
import io.github.jackwener.dsh.core.session.TurnError
import io.github.jackwener.dsh.core.session.TurnStatus
import io.github.jackwener.dsh.core.session.Usage
import io.github.jackwener.dsh.core.session.UserMsg

data class ConversationPreviewState(
    val label: String,
    val conversation: Conversation = Conversation(),
    val live: SessionLive = SessionLive(sessionId = "ui-preview"),
)

class ConversationPreviewStates : PreviewParameterProvider<ConversationPreviewState> {
    private fun turn(
        reply: String,
        status: TurnStatus = TurnStatus.Completed,
        error: TurnError? = null,
    ) = Turn(
        key = "preview-turn", number = 1,
        user = UserMsg(seq = 1, time = 0, text = "请用一个简单的例子解释二次函数。", images = 0, files = 0),
        blocks = if (reply.isEmpty()) emptyList() else listOf(Block.Text("preview-reply", reply, interrupted = false)),
        startTime = 0, endTime = if (status == TurnStatus.Running) null else 1000,
        status = status, error = error, usage = Usage(),
    )

    override val values = sequenceOf(
        ConversationPreviewState("正常回复", Conversation(listOf(turn("改变 **a** 会改变抛物线的开口。先看 y = x²，再试着把 a 改成 2。")))),
        ConversationPreviewState("正在生成", Conversation(listOf(turn("", TurnStatus.Running))), SessionLive("ui-preview", running = true)),
        ConversationPreviewState("空会话"),
        ConversationPreviewState("连接失败", Conversation(listOf(turn("", TurnStatus.Failed,
            TurnError("llm", "网络连接暂时中断，请检查网络后重试。", null, "请解释二次函数。"))))),
        ConversationPreviewState("长内容", Conversation(listOf(turn(
            "这是一段用于检查手机小屏布局的较长回复。请观察换行、段落间距与滚动。\n\n".repeat(8)
        )))),
    )

    override fun getDisplayName(index: Int): String = values.elementAt(index).label
}

// Render the actual conversation component with plain data: no engine, login or Hilt graph.
// This file is in src/debug and is excluded from release builds.
@Preview(name = "手机·浅色", widthDp = 390, heightDp = 760, locale = "zh-rCN")
@Preview(name = "手机·深色", widthDp = 390, heightDp = 760, locale = "zh-rCN", uiMode = Configuration.UI_MODE_NIGHT_YES)
@Preview(name = "小屏·大字", widthDp = 320, heightDp = 640, locale = "zh-rCN", fontScale = 1.3f)
@Composable
private fun DshUltraConversationPreview(
    @PreviewParameter(ConversationPreviewStates::class) state: ConversationPreviewState,
) {
    DshTheme {
        CompositionLocalProvider(LocalReducedMotion provides true) {
            Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase)) {
                DTopBar("DSH Ultra", onBack = null)
                ChatStream(
                    conv = state.conversation, live = state.live, details = WorkDetails.Standard,
                    listState = rememberLazyListState(),
                    onInspect = {}, onRetry = {}, onOpenSettings = {},
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}
