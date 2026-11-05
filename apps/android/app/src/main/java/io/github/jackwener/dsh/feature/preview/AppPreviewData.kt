package io.github.jackwener.dsh.feature.preview

import io.github.jackwener.dsh.BuildConfig
import io.github.jackwener.dsh.core.data.EventEntity
import io.github.jackwener.dsh.core.data.SessionDao
import io.github.jackwener.dsh.core.data.SessionEntity
import io.github.jackwener.dsh.core.session.LoggedEvent
import kotlinx.serialization.json.*

/** Local development fixtures. Only the separate x86 preview application uses these records. */
object AppPreviewData {
    const val LIMITS_ID = "ui_preview_limits_v1"
    const val PLAN_ID = "ui_preview_plan_v1"
    val enabled get() = BuildConfig.DEBUG && BuildConfig.LEARNING_PREVIEW

    val limitsReply = """
        **极限关注的是靠近时的趋势。**

        例如，当 x 越来越靠近 0 时，sin(x) / x 会越来越靠近 1。函数在 x = 0 处没有定义，但这不妨碍我们观察两边靠近的结果。

        ```dsh-visual
        {"version":1,"id":"limit-preview","type":"function","title":"靠近 0，观察函数值","description":"缩放图像，观察原点附近的变化。","functions":[{"expression":"sin(x)/x"},{"expression":"1","label":"极限值"}],"xDomain":[-5,5],"yDomain":[-0.5,1.5]}
        ```

        可以把 x = 0.1、0.01、-0.01 依次代入，看看它们与 1 有多接近。
    """.trimIndent()

    fun turnEvents(text: String, reply: String, turn: Int, firstSeq: Long, time: Long): List<LoggedEvent> {
        fun content(value: String) = buildJsonArray { addJsonObject { put("type", "text"); put("text", value) } }
        val data = listOf(
            "turn/start" to buildJsonObject { put("turn", turn) },
            "user/message" to buildJsonObject { putJsonObject("source") { put("kind", "user") }; put("content", content(text)) },
            "assistant/message" to buildJsonObject { putJsonObject("message") { put("content", content(reply)) } },
            "turn/end" to buildJsonObject { put("turn", turn); putJsonObject("reason") { put("kind", "completed") } },
        )
        return data.mapIndexed { index, (type, payload) -> LoggedEvent(firstSeq + index, type, time + index, payload) }
    }

    suspend fun seed(dao: SessionDao) {
        if (!enabled) return
        val now = System.currentTimeMillis()
        val samples = listOf(
            Triple(LIMITS_ID, "函数极限 · 界面预览示例", "给我讲解一下函数极限" to limitsReply),
            Triple(PLAN_ID, "学习计划 · 界面预览示例", "帮我安排一周的函数学习计划" to "第一天认识函数与图像；第二天练习定义域；第三、四天探索参数变化；第五天理解极限；周末用例题复习。\n\n这是一段用于检查聊天布局的本地示例内容。"),
        )
        for ((index, sample) in samples.withIndex()) {
            val (id, title, message) = sample
            if (dao.get(id) != null) continue
            dao.upsert(SessionEntity(id, title, now - index * 60_000, now - index * 60_000))
            for (event in turnEvents(message.first, message.second, 1, 1, now - index * 60_000)) {
                dao.insertEvent(EventEntity(id, event.seq, event.type, event.data.toString(), event.time))
            }
        }
    }
}
