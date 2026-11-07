package io.github.jackwener.dsh.feature.conversation

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.capability.tools.PptMasterFiles
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.Hairline
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.session.Block
import io.github.jackwener.dsh.core.session.ToolState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@Composable
internal fun PptResultCard(tool: Block.Tool, sessionId: String) {
    if (tool.name != PptMasterFiles.EXPORT_TOOL || tool.state != ToolState.Done) return
    val context = LocalContext.current
    val file by produceState<File?>(null, sessionId, tool.callId) {
        value = withContext(Dispatchers.IO) { PptMasterFiles.result(context, sessionId, tool.callId) }
    }
    val pptx = file ?: return
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp).border(Hairline, Dsh.colors.borderL3, Radius.lg).padding(horizontal = 12.dp, vertical = 6.dp)) {
        Text(pptx.name, style = DshType.s14, color = Dsh.colors.labelSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { launchPresentation(context, pptx, share = false) }) { Text(stringResource(R.string.ppt_open)) }
            TextButton(onClick = { launchPresentation(context, pptx, share = true) }) { Text(stringResource(R.string.share)) }
        }
    }
}

private fun launchPresentation(context: Context, file: File, share: Boolean) {
    runCatching {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        val intent = if (share) Intent(Intent.ACTION_SEND).apply {
            type = PptMasterFiles.MIME_TYPE
            putExtra(Intent.EXTRA_STREAM, uri)
        } else Intent(Intent.ACTION_VIEW).setDataAndType(uri, PptMasterFiles.MIME_TYPE)
        intent.clipData = ClipData.newRawUri(file.name, uri)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(if (share) Intent.createChooser(intent, context.getString(R.string.share)) else intent)
    }.onFailure {
        Toast.makeText(context, R.string.ppt_open_failed, Toast.LENGTH_SHORT).show()
    }
}
