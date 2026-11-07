package io.github.jackwener.dsh.core.capability.tools

import android.content.Context
import android.util.Log
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jackwener.dsh.core.capability.CallContext
import io.github.jackwener.dsh.core.capability.InvalidArgsException
import io.github.jackwener.dsh.core.capability.Tool
import io.github.jackwener.dsh.core.capability.ToolResult
import io.github.jackwener.dsh.core.capability.ToolSet
import io.github.jackwener.dsh.core.capability.int
import io.github.jackwener.dsh.core.capability.reqStr
import io.github.jackwener.dsh.core.capability.str
import io.github.jackwener.dsh.core.model.Risk
import io.github.jackwener.dsh.core.model.ToolGroup
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File
import java.security.MessageDigest
import java.util.Locale
import java.util.zip.ZipFile
import java.util.zip.ZipInputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PptMasterTools @Inject constructor(@ApplicationContext private val context: Context) : ToolSet {
    private val home = File(context.filesDir, "home")
    private val attachments = File(home, "attachments")
    private val drafts = File(home, "ppt-drafts")
    private val exportLock = Mutex()

    override val tools = listOf(
        object : Tool("ppt_read_source", ToolGroup.Files, Risk.read, false,
            "Read a document uploaded with WinKu's attachment picker. Supports PDF text, DOCX, XLSX, PPTX, TXT, MD, CSV and TSV.", {
                string("path", "Attachment path supplied by the conversation", required = true)
                int("start", "1-based first PDF page, or first text character in other files")
            }) {
            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult = withContext(Dispatchers.IO) {
                val path = args.reqStr("path")
                val requested = if (path.startsWith('/')) File(path) else File(attachments, path)
                val file = requested.canonicalFile
                if (file.parentFile != attachments.canonicalFile || !file.isFile || file.length() > MAX_SOURCE)
                    throw InvalidArgsException("Use an uploaded file no larger than 20 MB.")
                val start = (args.int("start") ?: 1).coerceIn(1, Int.MAX_VALUE - CHUNK)
                try {
                    val isPdf = file.extension.equals("pdf", true)
                    val doc = when (file.extension.lowercase(Locale.ROOT)) {
                        "pdf" -> DocText.pdf(context, file, start, start)
                        "docx", "xlsx", "pptx" -> {
                            ZipFile(file).use { zip ->
                                var expanded = 0L
                                for (entry in zip.entries()) {
                                    check(entry.size in 0L..(MAX_SOURCE - expanded)) { "The expanded document is too large." }
                                    expanded += entry.size
                                }
                            }
                            checkNotNull(DocText.office(file))
                        }
                        "txt", "md", "csv", "tsv" -> DocText.Extracted(file.readText().removePrefix("\uFEFF"), "UTF-8 text")
                        else -> return@withContext ToolResult.error("unsupported_source", "Unsupported document. For photos uploaded as files, use JPEG or PNG with the attachment:filename SVG reference.")
                    }
                    val offset = if (isPdf) 0 else start - 1
                    val text = doc.text.drop(offset).take(CHUNK)
                    if (text.isEmpty() || doc.text.isBlank()) return@withContext ToolResult.error("no_source_text", "${file.name}: ${doc.note}. No readable text in this range. Ask for a text copy if it is a scanned PDF.")
                    val more = if (offset + text.length < doc.text.length) {
                        if (isPdf) "\nThis page was truncated at $CHUNK characters."
                        else "\nContinue with start=${offset + text.length + 1}."
                    } else ""
                    ToolResult.text("${file.name} — ${doc.note}\n\n$text$more")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    ToolResult.error("source_read_failed", "Could not read ${file.name}: ${e.message.orEmpty().take(240)}")
                }
            }
        },
        object : Tool(PptMasterFiles.EXPORT_TOOL, ToolGroup.Files, Risk.write, false,
            "Export drafted SVG slides as an editable PowerPoint using PPT Master. The file appears in the chat.", {
                string("directory", "Absolute draft directory under \$HOME/ppt-drafts containing 01.svg, 02.svg, … and optional matching .md notes", required = true)
                string("title", "Deck title used as the .pptx filename", required = true)
                string("language", "Presentation language, e.g. zh-CN or en-US")
            }) {
            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult = withContext(Dispatchers.IO) {
                val dir = File(args.reqStr("directory")).canonicalFile
                if (dir.parentFile != drafts.canonicalFile || !dir.isDirectory)
                    throw InvalidArgsException("Create a dedicated draft directory directly under \$HOME/ppt-drafts.")
                val title = args.reqStr("title").replace(Regex("[\\p{Cntrl}\\\\/:*?\"<>|]"), "_")
                    .take(80).trim(' ', '.').ifBlank { "WinKu" }
                val language = args.str("language") ?: "zh-CN"
                if (!language.matches(Regex("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}")))
                    throw InvalidArgsException("Use a language tag such as zh-CN or en-US.")
                exportLock.withLock {
                    val output = PptMasterFiles.directory(context, call.sessionId, call.callId).apply { mkdirs() }
                    val staging = File.createTempFile("export-", ".tmp", output)
                    try {
                        val renderer = prepareRenderer()
                        if (!Python.isStarted()) Python.start(AndroidPlatform(context))
                        val count = Python.getInstance().getModule("winku_ppt_master").callAttr(
                            "export_deck", renderer.path, dir.path, attachments.path, staging.path, language,
                        ).toInt()
                        ensureActive()
                        check(staging.length() > 0) { "PPT Master returned an empty file." }
                        val name = if (title.endsWith(".pptx", true)) title else "$title.pptx"
                        check(staging.renameTo(File(output, name))) { "Could not publish the PowerPoint file." }
                        ToolResult.text("Created $name ($count slides). The user can open or share the file in the chat.")
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        Log.w("PptMaster", "Export failed", e)
                        ToolResult.error("ppt_export_failed", "PPT export failed: ${e.message.orEmpty().take(500)}")
                    } finally {
                        staging.delete()
                    }
                }
            }
        },
    )

    private fun prepareRenderer(): File {
        val root = File(context.noBackupFilesDir, "ppt-master-6.8.0")
        if (File(root, ".ready").isFile) return root
        ZipInputStream(context.assets.open("ppt-master-renderer.zip").buffered()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val target = File(root, entry.name).canonicalFile
                check(target.path.startsWith(root.canonicalPath + File.separator)) { "Invalid renderer archive path." }
                target.parentFile?.mkdirs()
                target.outputStream().buffered().use { zip.copyTo(it) }
                zip.closeEntry()
            }
        }
        File(root, ".ready").writeText("6.8.0")
        return root
    }

    private companion object {
        const val MAX_SOURCE = 20L * 1024 * 1024
        const val CHUNK = 12_000
    }
}

object PptMasterFiles {
    const val EXPORT_TOOL = "ppt_export"
    const val MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    private fun hash(id: String): String = MessageDigest.getInstance("SHA-256")
        .digest(id.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    fun directory(context: Context, sessionId: String, callId: String): File =
        File(context.filesDir, "presentations/${hash(sessionId)}/${hash(callId)}")

    fun result(context: Context, sessionId: String, callId: String): File? =
        directory(context, sessionId, callId).listFiles()?.firstOrNull { it.isFile && it.extension.equals("pptx", true) }
}
