package io.github.jackwener.dsh.feature.tools

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.*

/** Student tool entry, with a real navigation destination and an honest empty state. */
@Composable
fun ToolsScreen(onBack: () -> Unit) {
    val c = Dsh.colors
    Column(Modifier.fillMaxSize().background(c.bgBase).statusBarsPadding().navigationBarsPadding()) {
        DTopBar(stringResource(R.string.tools_title), onBack)
        Column(Modifier.weight(1f).fillMaxWidth().padding(32.dp),
            verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(64.dp).clip(Radius.lg).background(c.selector), contentAlignment = Alignment.Center) {
                DIcon(R.drawable.dsw_apps_add_outline, size = 28.dp, tint = c.labelSecondary)
            }
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.tools_empty_title), style = DshType.base16m, color = c.labelPrimary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.tools_empty_body), style = DshType.s14, color = c.labelTertiary, textAlign = TextAlign.Center)
        }
    }
}
