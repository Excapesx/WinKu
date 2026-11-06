package io.github.jackwener.dsh.core.session

/** Regeneration is a fresh answer in the existing context, not a replay of device actions. */
internal const val REGENERATE_REPLY = APP_PROMPT_PREFIX +
    "用户点击了重新生成。请重新完整回答当前这轮用户的原问题，保留原问题的条件与图片信息。" +
    "重新检查结论和推导，给出独立完整的新回答，不要续写上一版，也不要解释本指令。" +
    "已完成的文件修改、手机操作和外部动作不要重复执行；需要新的有副作用操作时先询问用户。"

fun Turn.canRegenerate(live: SessionLive): Boolean =
    !live.running && !live.hasPendingRequest && live.queue.isEmpty() && live.steers.isEmpty() && user != null &&
        reply != null && status != TurnStatus.Steered
