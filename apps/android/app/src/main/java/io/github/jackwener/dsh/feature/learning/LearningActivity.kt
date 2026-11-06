package io.github.jackwener.dsh.feature.learning

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshTheme
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.DTopBar
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Offline component examples, available without starting the agent or granting phone permissions. */
class LearningActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val examples = Json.parseToJsonElement(assets.open("learning/examples.json").bufferedReader().use { it.readText() }).jsonObject
        setContent {
            DshTheme {
                val entries = examples.values.map { it.jsonObject }
                var selected by remember { mutableIntStateOf(entries.indexOfFirst { it["type"]?.jsonPrimitive?.content == intent.getStringExtra("component") }.coerceAtLeast(0)) }
                val labels = listOf("函数", "流程图", "图表", "小测验", "公式", "表格", "代码", "交互内容", "知识地图", "分步讲解", "对照卡", "学习计划", "公式标注", "化学方程式")
                Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).statusBarsPadding()) {
                    DTopBar(stringResource(R.string.learning_title), { finish() })
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        entries.forEachIndexed { index, _ -> FilterChip(selected = selected == index, onClick = { selected = index }, label = { Text(labels[index]) }) }
                    }
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(16.dp)) {
                        Text(stringResource(R.string.learning_intro), style = DshType.s14, color = Dsh.colors.labelSecondary)
                        Spacer(Modifier.height(16.dp))
                        val payload = entries[selected]
                        LearningCard(RichPart.Artifact(payload, RichContent.fingerprint(payload.toString())), "examples/$selected")
                        Spacer(Modifier.height(16.dp))
                        Text(stringResource(R.string.learning_demo_note), style = DshType.xxs12, color = Dsh.colors.labelSecondary)
                    }
                }
            }
        }
    }
}
