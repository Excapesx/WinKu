import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const nm = resolve(process.env.DSH_STAGE_NM ?? 'build/winku-engine/stage/node_modules')
const require = createRequire(join(nm, '../package.json'))
const { parse } = require(join(nm, 'yaml'))
const source = readFileSync('js/packages/bundle-android/cordis.patch.yml', 'utf8')
const packaged = readFileSync(join(nm, '@dsh-android/bundle-android/cordis.patch.yml'), 'utf8')
const profile = parse(packaged, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] })
const { Context } = await import(pathToFileURL(join(nm, '@deepseek-ai/cordis/lib/index.js')))
const { SystemPrompt, renderPrompt } = await import(pathToFileURL(join(nm, '@deepseek-ai/dsh-system-prompt/lib/index.js')))
const { HarnessSdkJsonRpcServer } = await import(pathToFileURL(join(nm, '@deepseek-ai/dsh-sdk-jsonrpc-server/lib/index.js')))
const { systemPromptSection, screenSection } = await import(pathToFileURL(join(nm, '@dsh-android/plugin-guard/index.js')))

test('the shipped engine has the same WinKu persona as the source', () => {
  assert.equal(packaged.replaceAll('\r', ''), source.replaceAll('\r', ''))
})

test('the shipped prompt teaches textbook math for prose and every quiz field', () => {
  const local = readFileSync('js/packages/plugin-guard/learning.js', 'utf8')
  const shipped = readFileSync(join(nm, '@dsh-android/plugin-guard/learning.js'), 'utf8')
  assert.equal(shipped.replaceAll('\r', ''), local.replaceAll('\r', ''))
  const prompt = systemPromptSection('zh-CN', [])
  for (const notation of ['Textbook mathematical notation', 'prompt/options/hint/explanation', '\\frac{numerator}{denominator}', '\\lim_{x\\to a}', '\\begin{aligned}']) assert.ok(prompt.includes(notation), notation)
  assert.doesNotMatch(prompt, /\u0008|\u000c/)
})

test('the packaged generation guide includes structured teaching and annotated chemistry examples', async () => {
  const filename='@dsh-android/plugin-guard/learning-templates.js'
  assert.equal(readFileSync(join(nm,filename),'utf8').replaceAll('\r',''),readFileSync('js/packages/plugin-guard/learning-templates.js','utf8').replaceAll('\r',''))
  const {learningTemplates}=await import(pathToFileURL(join(nm,filename)))
  const prompt=systemPromptSection('zh-CN',[])
  for(const item of learningTemplates)assert.ok(prompt.includes(JSON.stringify(item.spec)),item.name)
  for(const syntax of ['How to generate teaching components','\\underbrace','\\overbrace','\\xrightarrow','\\ce{','line-wrap'])assert.ok(prompt.includes(syntax),syntax)
})

test('the real prompt assembler identifies the product as WinKu for different models', async () => {
  const config = profile.find(row => row.id === 'system-prompt').config
  for (const model of ['provider-a/model-a', 'provider-b/model-b']) {
    const ctx = new Context()
    const plugin = await ctx.plugin(SystemPrompt, config)
    try {
      ctx.systemPrompt.variable('model', () => model)
      const assembly = await ctx.systemPrompt.assemble()
      const text = renderPrompt(assembly)
      assert.match(text, /^You are WinKu,/)
      assert.ok(text.includes(model), 'model attribution follows the configured model')
      assert.ok(!assembly.sections.some(section => section.name === 'harness:identity'))
      assert.doesNotMatch(text, /You are DSH|powered by DeepSeek Harness/i)
    } finally { await plugin.dispose() }
  }
})

test('vendor-specific model and search routes cannot start in the shipped profile', () => {
  for (const id of ['llm-deepseek', 'llm-deepseek-account', 'web-search-deepseek', 'web-deepseek-api', 'deepseek-llm-api-extensions']) {
    assert.equal(profile.find(row => row.id === id)?.disabled, true, id)
  }
  const web = profile.find(row => row.id === 'tool-web').config
  assert.equal(web.search, false)
  assert.equal(web.fetch, true)
})

test('packaged device instructions consistently name WinKu', () => {
  const descriptors = [{ name: 'screen_read', group: 'screen' }, { name: 'app_guide', group: 'apps' }]
  for (const locale of ['zh-CN', 'en']) {
    const text = systemPromptSection(locale, descriptors) + screenSection(descriptors)
    assert.match(text, /inside the WinKu app/)
    assert.doesNotMatch(text, /\bDSH\b|DeepSeek/)
  }
})

test('the real SDK refuses every unconfigured route without loading a vendor fallback', async () => {
  let mounted = false
  const server = { hasAdapterFor: () => false, ctx: { plugin: async () => { mounted = true } } }
  for (const provider of ['deepseek-official', 'missing-provider']) {
    await assert.rejects(HarnessSdkJsonRpcServer.prototype.initialize.call(server, { cwd: '.', provider, model: 'm' }), /no adapter registered/)
  }
  assert.equal(mounted, false)
})

test('the real SDK forwards an explicit route and reports the independent harness identity', async () => {
  const calls = []
  const server = { hasAdapterFor: () => true, ctx: { get: () => ({ resolveCallConfig: async config => calls.push(config) }) } }
  const result = await HarnessSdkJsonRpcServer.prototype.initialize.call(server, { cwd: '.', provider: 'configured-provider', model: 'configured-model' })
  assert.equal(result.serverInfo.name, 'winku-harness-sdk-runtime')
  assert.equal(calls[0].provider, 'configured-provider')
  assert.equal(calls[0].model, 'configured-model')
})
