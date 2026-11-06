import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setupAssistantStream } from '../packages/plugin-guard/assistant-stream.js'

function fixture() {
  const listeners = new Map(), pending = new Map(), sent = [], disposers = []
  let clock = 0, id = 0
  const ctx = {
    on(name, fn) { listeners.set(name, [...listeners.get(name) ?? [], fn]); return () => listeners.set(name, listeners.get(name).filter(f => f !== fn)) },
    emit(name, ...args) { for (const fn of listeners.get(name) ?? []) fn(...args) },
    effect(fn) { disposers.push(fn()) },
  }
  ctx.on('sdk-extensions/notify', (method, params) => sent.push(JSON.parse(JSON.stringify({ method, params }))))
  setupAssistantStream(ctx, { now: () => clock, schedule: (fn, ms) => { pending.set(++id, { at: clock + ms, fn }); return id }, cancel: id => pending.delete(id) })
  return { ctx, sent, pending,
    frame(frame, session = 's') { ctx.emit('agent/assistant-stream', { agent: { session: { id: session } }, frame }) },
    advance(ms) { clock += ms; for (const [id, t] of pending) if (t.at <= clock) { pending.delete(id); t.fn() } },
    dispose() { disposers.forEach(fn => fn()) },
  }
}
const start = (attemptId = 'a', revision = 1) => ({ type: 'start', attemptId, revision, turn: 1, step: 1 })
const delta = (revision, text, extra = {}) => ({ type: 'chunk', attemptId: 'a', revision, chunk: { type: 'text-delta', index: 0, text }, ...extra })

test('first text is immediate and dense subsequent tokens share one 24ms snapshot', () => {
  const f = fixture(); f.frame(start()); f.frame(delta(2, '你'))
  assert.equal(f.sent.at(-1).params.blocks[0].text, '你')
  f.frame(delta(3, '好')); f.advance(10); f.frame(delta(4, '，🙂'))
  assert.equal(f.sent.length, 2)
  assert.equal(f.pending.size, 1)
  f.advance(14)
  assert.equal(f.sent.at(-1).params.blocks[0].text, '你好，🙂')
  assert.equal(f.sent.length, 3)
})

test('settlement cancels queued partials without delaying the durable answer', () => {
  const f = fixture(); f.frame(start()); f.frame(delta(2, 'a')); f.frame(delta(3, 'b'))
  f.frame({ type: 'end', attemptId: 'a', revision: 4, outcome: { kind: 'committed', seq: 9 } })
  assert.equal(f.sent.at(-1).params.phase, 'end')
  const n = f.sent.length; f.advance(1000)
  assert.equal(f.sent.length, n)
  assert.equal(f.pending.size, 0)
})

test('retry drops the previous attempt and sessions have independent buffers', () => {
  const f = fixture(); f.frame(start()); f.frame(delta(2, 'old')); f.frame(delta(3, ' pending'))
  f.frame(start('b', 4)); f.frame(delta(5, 'late'))
  f.frame(delta(6, 'new', { attemptId: 'b' }))
  f.frame(start('c'), 'other'); f.frame(delta(2, 'other', { attemptId: 'c' }), 'other')
  f.advance(1000)
  assert.equal(f.sent.findLast(v => v.params.sessionId === 's').params.blocks[0].text, 'new')
  assert.equal(f.sent.at(-1).params.blocks[0].text, 'other')
})

test('reasoning, authoritative block end and late deltas follow the engine block contract', () => {
  const f = fixture(); f.frame(start())
  f.frame({ type: 'chunk', attemptId: 'a', revision: 2, chunk: { type: 'reasoning-delta', index: 0, text: 'think' } })
  f.frame({ type: 'chunk', attemptId: 'a', revision: 3, chunk: { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'thought' } } })
  f.frame(delta(4, 'bad')); f.frame(delta(5, 'answer', { chunk: { type: 'text-delta', index: 1, text: 'answer' } }))
  f.advance(24)
  assert.deepEqual(f.sent.at(-1).params.blocks.map(b => [b.type, b.text]), [['reasoning', 'thought'], ['text', 'answer']])
  f.dispose(); assert.equal(f.pending.size, 0)
})

test('a resumed Agent can restart its raw revisions without rolling back the display sequence', () => {
  const f = fixture(); f.frame(start()); f.frame(delta(2, 'first'))
  f.frame({ type: 'end', attemptId: 'a', revision: 3 })
  const before = f.sent.at(-1).params.revision
  f.frame(start()); f.frame(delta(2, 'resumed'))
  assert.equal(f.sent.at(-1).params.blocks[0].text, 'resumed')
  assert.ok(f.sent.at(-1).params.revision > before)
})

test('block-start order is retained when deltas for separate blocks interleave', () => {
  const f = fixture(); f.frame(start())
  const chunk = (revision, value) => f.frame({ type: 'chunk', attemptId: 'a', revision, chunk: value })
  chunk(2, { type: 'block-start', index: 0, blockType: 'text' })
  chunk(3, { type: 'block-start', index: 1, blockType: 'reasoning' })
  chunk(4, { type: 'reasoning-delta', index: 1, text: 'think' })
  chunk(5, { type: 'text-delta', index: 0, text: 'answer' })
  f.advance(24)
  assert.deepEqual(f.sent.at(-1).params.blocks.map(b => b.type), ['text', 'reasoning'])
})

test('the shipped plugin and real SDK deliver transient text before the durable message', async () => {
  const nm = resolve(process.env.DSH_STAGE_NM ?? 'build/winku-engine/stage/node_modules')
  assert.equal(readFileSync(join(nm, '@dsh-android/plugin-guard/assistant-stream.js'), 'utf8').replaceAll('\r', ''),
    readFileSync('js/packages/plugin-guard/assistant-stream.js', 'utf8').replaceAll('\r', ''))
  const { Context } = await import(pathToFileURL(join(nm, '@deepseek-ai/cordis/lib/index.js')))
  const { HarnessSdkJsonRpcServer } = await import(pathToFileURL(join(nm, '@deepseek-ai/dsh-sdk-jsonrpc-server/lib/index.js')))
  const ctx = new Context(), sent = []
  const plugin = await ctx.plugin({ name: 'stream-test', apply: setupAssistantStream })
  const server = new HarnessSdkJsonRpcServer(ctx, { notify: (method, params) => sent.push({ method, params }) })
  try {
    const agent = { session: { id: 's' } }
    ctx.emit('agent/assistant-stream', { agent, frame: start() })
    ctx.emit('agent/assistant-stream', { agent, frame: delta(2, 'first') })
    assert.equal(sent.at(-1).params.blocks[0].text, 'first')
    ctx.emit('agent/assistant-stream', { agent, frame: delta(3, ' last') })
    ctx.emit('session/event', agent.session, { seq: 7, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'first last' }] } } })
    ctx.emit('agent/assistant-stream', { agent, frame: { type: 'end', attemptId: 'a', revision: 4 } })
    assert.deepEqual(sent.slice(-2).map(v => v.method), ['session.event', 'session.assistant-stream'])
    assert.equal(sent.at(-1).params.phase, 'end')
  } finally { server.disposers.forEach(dispose => dispose()); await plugin.dispose() }
})
