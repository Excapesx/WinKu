// Transient display snapshots; durable assistant/message remains the history/usage source.
export function setupAssistantStream(ctx, { intervalMs = 24, schedule = setTimeout, cancel = clearTimeout, now = Date.now } = {}) {
  const sessions = new Map()
  // Engine attempt revisions restart when an Agent is reattached. The SDK display sequence must
  // remain monotonic for the whole engine generation, including resumed sessions.
  const revisions = new Map()
  const notify = payload => {
    const revision = (revisions.get(payload.sessionId) ?? 0) + 1
    revisions.set(payload.sessionId, revision)
    ctx.emit('sdk-extensions/notify', 'session.assistant-stream', { ...payload, revision })
  }
  const snapshot = s => ({ sessionId: s.sessionId, attemptId: s.attemptId, revision: s.revision,
    turn: s.turn, step: s.step, startedAt: s.startedAt, phase: 'streaming',
    blocks: [...s.blocks.values()].map(block => ({ ...block })) })
  const flush = s => { s.timer = undefined; if (!s.dirty) return; s.dirty = false; s.visible = true; notify(snapshot(s)) }
  const stop = s => { if (s.timer !== undefined) cancel(s.timer) }
  const off = ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    const sessionId = agent?.session?.id
    if (typeof sessionId !== 'string' || !frame?.attemptId) return
    if (frame.type === 'start') {
      const old = sessions.get(sessionId)
      if (old) stop(old)
      const s = { sessionId, attemptId: frame.attemptId, revision: frame.revision,
        turn: frame.turn, step: frame.step, startedAt: now(), blocks: new Map(), dirty: false, visible: false }
      sessions.set(sessionId, s); notify(snapshot(s)); return
    }
    const s = sessions.get(sessionId)
    if (!s || s.attemptId !== frame.attemptId || frame.revision <= s.revision) return
    s.revision = frame.revision
    if (frame.type === 'end') {
      // The durable event is forwarded before end. No queued partial may resurrect it.
      stop(s); sessions.delete(sessionId); notify({ ...snapshot(s), phase: 'end', blocks: [] }); return
    }
    const chunk = frame.chunk
    if (frame.type !== 'chunk' || !chunk) return
    if (chunk.type === 'block-start') {
      if ((chunk.blockType === 'text' || chunk.blockType === 'reasoning') && !s.blocks.has(chunk.index)) {
        s.blocks.set(chunk.index, { index: chunk.index, type: chunk.blockType, text: '' })
      }
      return
    }
    const type = chunk.type === 'text-delta' ? 'text' : chunk.type === 'reasoning-delta' ? 'reasoning' :
      chunk.type === 'block-end' ? chunk.block?.type : undefined
    if ((type !== 'text' && type !== 'reasoning') || !Number.isInteger(chunk.index)) return
    const previous = s.blocks.get(chunk.index)
    if (previous?.closed) return
    const text = chunk.type === 'block-end' ? chunk.block.text : (previous?.text ?? '') + (chunk.text ?? '')
    if (typeof text !== 'string') return
    s.blocks.set(chunk.index, { index: chunk.index, type, text, ...(chunk.type === 'block-end' ? { closed: true } : {}) })
    s.dirty = true
    if (!s.visible) flush(s)
    else if (s.timer === undefined) s.timer = schedule(() => flush(s), intervalMs)
  })
  ctx.effect(() => () => { off(); for (const s of sessions.values()) stop(s); sessions.clear(); revisions.clear() })
}
