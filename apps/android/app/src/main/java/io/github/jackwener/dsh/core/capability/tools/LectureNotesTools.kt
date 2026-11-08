package io.github.jackwener.dsh.core.capability.tools

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineSenseVoiceModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jackwener.dsh.core.capability.CallContext
import io.github.jackwener.dsh.core.capability.InvalidArgsException
import io.github.jackwener.dsh.core.capability.Tool
import io.github.jackwener.dsh.core.capability.ToolResult
import io.github.jackwener.dsh.core.capability.ToolSet
import io.github.jackwener.dsh.core.capability.int
import io.github.jackwener.dsh.core.capability.reqStr
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
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong

private const val SPEECH_RATE = 16_000
private const val SECOND_US = 1_000_000L

@Singleton
class LectureNotesTools @Inject constructor(@ApplicationContext private val context: Context) : ToolSet {
    private val lock = Mutex()
    private val attachments = File(context.filesDir, "home/attachments")

    override val tools = listOf(object : Tool(
        "lecture_transcribe", ToolGroup.Files, Risk.read, false,
        "Locally transcribe an attached WAV, MP3, M4A, AAC, FLAC or OGG recording with timestamps. The first run downloads the offline model.",
        {
            string("path", "Path of the recording attached to this conversation", required = true)
            int("start", "Start time in seconds; default 0")
            int("end", "End time in seconds; maximum 1200 seconds after start")
        }, timeoutMs = 15 * 60_000L,
    ) {
        override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult = withContext(Dispatchers.IO) {
            val input = File(args.reqStr("path"))
            val file = (if (input.isAbsolute) input else File(attachments, input.path)).canonicalFile
            if (file.parentFile != attachments.canonicalFile || !file.isFile || file.extension.lowercase(Locale.ROOT) !in
                setOf("wav", "mp3", "m4a", "aac", "flac", "ogg", "opus") || file.length() > 192L * 1024 * 1024)
                throw InvalidArgsException("Use an attached recording up to 192 MB.")
            val start = args.int("start") ?: 0
            val end = args.int("end") ?: (start.toLong() + 1200).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
            if (start < 0 || end.toLong() - start !in 1L..1200L)
                throw InvalidArgsException("Use a time range between 1 second and 20 minutes.")
            lock.withLock {
                try {
                    val cache = File(context.noBackupFilesDir, "lecture-models")
                    val model = File(appPython(context).getModule("winku_speech_assets").callAttr("prepare_model", cache.path).toString())
                    ensureActive()
                    val result = transcribe(file, model, start, end) { ensureActive() }
                    if (result.text.isBlank()) ToolResult.error("no_speech", "No clear speech found from ${start}s to ${result.end}s.")
                    else ToolResult.text("Recording: ${file.name}. Decoded ${start}s to ${result.end}s. Source transcript only.\n${result.text}")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: LinkageError) {
                    ToolResult.error("speech_runtime", "Offline speech recognition is unavailable on this device.")
                } catch (e: Exception) {
                    ToolResult.error("transcription_failed", "Could not transcribe the recording: ${e.message.orEmpty().take(250)}")
                }
            }
        }
    })
}

private data class LectureTranscript(val text: String, val end: Long)

private fun transcribe(file: File, model: File, start: Int, end: Int, checkActive: () -> Unit): LectureTranscript {
    val recognizer = OfflineRecognizer(config = OfflineRecognizerConfig(modelConfig = OfflineModelConfig(
        senseVoice = OfflineSenseVoiceModelConfig(model.resolve("model.int8.onnx").path, "auto"),
        tokens = model.resolve("tokens.txt").path,
        numThreads = 4,
    )))
    try {
        val vad = Vad(config = VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(
            model = model.resolve("silero_vad.onnx").path, threshold = 0.33f,
            minSilenceDuration = 0.52f, maxSpeechDuration = 17f,
        )))
        try {
            val text = StringBuilder()
            val window = FloatArray(512)
            var pending = 0
            fun consume() {
                while (!vad.empty()) {
                    checkActive()
                    val speech = vad.front()
                    vad.pop()
                    val stream = recognizer.createStream()
                    try {
                        stream.acceptWaveform(speech.samples, SPEECH_RATE)
                        recognizer.decode(stream)
                        val line = recognizer.getResult(stream).text.trim()
                        val time = start + speech.start / SPEECH_RATE
                        if (line.isNotEmpty()) text.appendLine("[%02d:%02d] %s".format(Locale.ROOT, time / 60, time % 60, line))
                    } finally { stream.release() }
                }
            }
            val decodedEnd = decodeRecording(file, start * SECOND_US, end * SECOND_US, checkActive) {
                var offset = 0
                while (offset < it.size) {
                    val length = minOf(window.size - pending, it.size - offset)
                    it.copyInto(window, pending, offset, offset + length)
                    pending += length
                    offset += length
                    if (pending == window.size) {
                        vad.acceptWaveform(window)
                        consume()
                        pending = 0
                    }
                }
            }
            if (pending > 0) {
                window.fill(0f, pending)
                vad.acceptWaveform(window)
            }
            vad.flush()
            consume()
            return LectureTranscript(text.toString(), (decodedEnd + SPEECH_RATE - 1) / SPEECH_RATE)
        } finally { vad.release() }
    } finally { recognizer.release() }
}

private fun decodeRecording(file: File, start: Long, end: Long, checkActive: () -> Unit, accept: (FloatArray) -> Unit): Long {
    val extractor = MediaExtractor()
    try {
        extractor.setDataSource(file.path)
        val track = (0 until extractor.trackCount).firstOrNull {
            extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
        } ?: error("No audio track found")
        val format = extractor.getTrackFormat(track)
        val mime = checkNotNull(format.getString(MediaFormat.KEY_MIME))
        extractor.selectTrack(track)
        if (start > 0) extractor.seekTo(start, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
        var next = start * SPEECH_RATE / SECOND_US
        val limit = end * SPEECH_RATE / SECOND_US
        fun pcm(buffer: ByteBuffer, offset: Int, size: Int, pts: Long, info: MediaFormat) {
            val rate = info.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val channels = info.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val encoding = info.getInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
            val bytes = when (encoding) {
                AudioFormat.ENCODING_PCM_16BIT -> 2
                AudioFormat.ENCODING_PCM_FLOAT -> 4
                AudioFormat.ENCODING_PCM_8BIT -> 1
                else -> error("Unsupported PCM audio encoding")
            }
            val frames = size / (channels * bytes)
            val first = (pts * SPEECH_RATE / SECOND_US.toDouble()).roundToLong()
            val last = minOf(limit, first + (frames * SPEECH_RATE / rate.toDouble()).roundToLong())
            if (last <= next || frames == 0) return
            while (first > next && next < limit) {
                val silence = minOf(first - next, limit - next, SPEECH_RATE.toLong()).toInt()
                accept(FloatArray(silence))
                next += silence
            }
            if (last <= next) return
            buffer.order(ByteOrder.nativeOrder())
            accept(FloatArray((last - next).toInt()) { index ->
                val frame = ((next + index - first) * rate / SPEECH_RATE).toInt().coerceIn(0, frames - 1)
                var mono = 0f
                repeat(channels) { channel ->
                    val pos = offset + (frame * channels + channel) * bytes
                    mono += when (encoding) {
                        AudioFormat.ENCODING_PCM_FLOAT -> buffer.getFloat(pos)
                        AudioFormat.ENCODING_PCM_8BIT -> ((buffer.get(pos).toInt() and 255) - 128) / 128f
                        else -> buffer.getShort(pos) / 32768f
                    }
                }
                (mono * 2.5f / channels).coerceIn(-0.99f, 0.99f)
            })
            next = last
        }
        if (mime == "audio/raw") {
            val buffer = ByteBuffer.allocateDirect(format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 256 * 1024).coerceAtLeast(256 * 1024))
            while (next < limit && extractor.sampleTime in 0L until end) {
                checkActive()
                buffer.clear()
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0) break
                pcm(buffer, 0, size, extractor.sampleTime, format)
                extractor.advance()
            }
        } else {
            val codec = MediaCodec.createDecoderByType(mime)
            try {
                codec.configure(format, null, null, 0)
                codec.start()
                val info = MediaCodec.BufferInfo()
                var inputEnded = false
                while (next < limit) {
                    checkActive()
                    if (!inputEnded) {
                        val index = codec.dequeueInputBuffer(5_000)
                        if (index >= 0) {
                            val pts = extractor.sampleTime
                            val size = if (pts < 0 || pts >= end) -1 else extractor.readSampleData(checkNotNull(codec.getInputBuffer(index)), 0)
                            inputEnded = size < 0
                            codec.queueInputBuffer(index, 0, size.coerceAtLeast(0), pts.coerceAtLeast(0),
                                if (inputEnded) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0)
                            if (!inputEnded) extractor.advance()
                        }
                    }
                    val index = codec.dequeueOutputBuffer(info, 5_000)
                    if (index >= 0) {
                        try {
                            if (info.size > 0) pcm(checkNotNull(codec.getOutputBuffer(index)), info.offset,
                                info.size, info.presentationTimeUs, codec.outputFormat)
                        } finally { codec.releaseOutputBuffer(index, false) }
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                    }
                }
            } finally { codec.release() }
        }
        return next
    } finally { extractor.release() }
}
