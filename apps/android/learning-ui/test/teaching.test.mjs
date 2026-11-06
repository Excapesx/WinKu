import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpec} from '../src/schema.mjs';
import {renderFormula,renderMathText} from '../src/math-text.mjs';
import {highlightedCode,renderCodeBlock} from '../src/code-block.mjs';
import {learningTemplates,learningGenerationGuide} from '../../js/packages/plugin-guard/learning-templates.js';

test('every component generation example is parseable and accepted by the shipped schema',()=>{
  const snippets=[...learningGenerationGuide.matchAll(/```dsh-visual\n([\s\S]*?)\n```/g)].map(match=>JSON.parse(match[1]));
  assert.equal(snippets.length,learningTemplates.length);
  for(const spec of snippets){
    const normalized=normalizeSpec(spec);assert.equal(normalized.id,spec.id);
    if(spec.type==='math')assert.doesNotMatch(renderFormula(spec.latex,true),/math-error/);
  }
  assert.deepEqual(new Set(snippets.filter(s=>s.type==='explanation').map(s=>s.layout)),new Set(['flow','steps','compare','summary']));
});
test('explanation data has bounded items and cannot inject style or arbitrary icon markup',()=>{
  const input={type:'explanation',layout:'steps',items:Array(20).fill({title:'步骤',body:'说明',tone:'url(x)',icon:'<script>'}),facts:Array(20).fill({label:'目标',value:'理解'}),points:Array(30).fill('要点')};
  const result=normalizeSpec(input);assert.equal(result.items.length,8);assert.equal(result.facts.length,8);assert.equal(result.points.length,12);
  assert.equal(result.items[0].tone,'neutral');assert.equal(result.items[0].icon,'book');
  assert.throws(()=>normalizeSpec({type:'explanation',layout:'unknown',items:[{}]}));
  assert.throws(()=>normalizeSpec({type:'explanation',layout:'flow',items:[]}));
});
test('underbrace, overbrace, labelled steps and chemistry preserve their annotations',()=>{
  for(const latex of [String.raw`\underbrace{\frac{\tan x}{x}}_{\to1}`,String.raw`\overbrace{a+b}^{\text{一组}}`,String.raw`a\overset{\text{理由}}{=}b\xrightarrow[\text{下方}]{\text{条件}}c`,String.raw`\ce{Ag+ + Cl- -> AgCl v}`,String.raw`\ce{N2(g) + 3H2(g) <=>[\text{催化剂}] 2NH3(g)}`]){
    const html=renderFormula(latex,true);assert.doesNotMatch(html,/math-error/);assert.match(html,/class="katex"/);
  }
});
test('C++ aliases receive a language label and distinct keyword, type, number and comment scopes',()=>{
  const source='int* p = new int(10); // 创建对象';
  for(const alias of ['cpp','c++','cxx','cc']){
    const result=highlightedCode(source,alias);assert.equal(result.label,'C++');
    for(const scope of ['hljs-type','hljs-keyword','hljs-number','hljs-comment'])assert.ok(result.html.includes(scope),scope);
  }
  const html=renderMathText('```cpp\n'+source+'\n```');
  assert.match(html,/code-header/);assert.match(html,/data-code-action="copy"/);assert.match(html,/data-code-action="wrap"/);assert.match(html,/C\+\+/);
});
test('unknown languages, incomplete streaming code and HTML-looking strings stay literal',()=>{
  for(const language of ['unknown','constructor','__proto__','text']){
    const html=renderCodeBlock('<img onerror="alert(1)">',language);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
  }
  const code='auto p = std::make_unique<Widget>("中文 👩‍💻");\n\t// 保留缩进';
  for(let end=1;end<=code.length;end++)assert.equal(typeof renderCodeBlock(code.slice(0,end),'cpp'),'string');
  assert.doesNotMatch(renderMathText('```cpp\n"$\\frac{1}{2}$"\n```'),/class="katex"/);
});
