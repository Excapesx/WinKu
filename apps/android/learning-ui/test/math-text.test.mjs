import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMathText,renderFormula,textbookQuizText} from '../src/math-text.mjs';

test('screenshot examples render real fractions and limits, including all four delimiters',()=>{
  for(const text of [String.raw`① 用一次洛必达：$\displaystyle\lim_{x\to0}\frac{\sin x}{x}=1$`,String.raw`\[\lim_{x\to0}\frac{1-\cos x}{x^2}=\frac12\]`,String.raw`结果为 \(\frac{1}{2}\)。`,String.raw`$$\lim_{x\to0^+}x\ln x=0$$`]){
    const html=renderMathText(text);assert.match(html,/class="katex"/);assert.match(html,/math-inline|math-display/);assert.doesNotMatch(html,/math-error|math-pending/);
  }
  assert.match(renderFormula('1/2'),/class="mfrac"/);
  assert.match(renderFormula(String.raw`\infty/\infty`),/class="mfrac"/);
});
test('legacy quiz keeps the expression meaning while converting to textbook notation',()=>{
  const text=textbookQuizText('lim(x→0) (e^x - 1 - x)/x² 等于?');
  assert.match(text,/\\lim_\{x\\to 0\}/);assert.match(text,/\\frac/);assert.match(text,/等于\?/);
  assert.match(renderMathText(text),/class="mfrac"/);
  assert.match(textbookQuizText('1/2'),/\\frac/);
  for(const original of ['查看 https://example.com/a/b','2026/11/06','速度 1/2 m/s','a/b 是路径名',String.raw`$\frac{1}{2}$`])assert.equal(textbookQuizText(original),original);
});
test('code, escaped dollar signs, prices and non-math text are preserved',()=>{
  const code=renderMathText('`$x^2$`\n\n```python\nprice = "$5"\n```');
  assert.match(code,/<code>\$x\^2\$<\/code>/);assert.doesNotMatch(code,/class="katex"/);
  const money=renderMathText(String.raw`价格 \$5，预算 $5 and $10。`);
  assert.doesNotMatch(money,/class="katex"|math-pending/);assert.match(money,/预算 \$5 and \$10/);
});
test('unfinished streamed formula settles on closure without exposing TeX commands',()=>{
  const prefix=String.raw`结论：$\frac{1}`;
  assert.match(renderMathText(prefix),/math-pending/);assert.doesNotMatch(renderMathText(prefix),/\\frac/);
  const finished=renderMathText(prefix+'{2}$。');assert.match(finished,/class="mfrac"/);assert.doesNotMatch(finished,/math-pending/);assert.match(finished,/。/);
});
test('Chinese bold next to quotation marks renders without literal stars',()=>{
  const html=renderMathText('把**“两个无穷小（或无穷大）谁快谁慢”**的比较，换成**“它们的导数谁大谁小”**的比较。');
  assert.equal((html.match(/<strong>/g)||[]).length,2);assert.doesNotMatch(html,/\*\*/);
});
test('every streamed prefix of a mixed derivation remains renderable',()=>{
  const text=String.raw`把**“变化率”**写成公式：$\displaystyle\lim_{x\to0}\frac{\sin x}{x}=1$。再看 $$\frac{1-\cos x}{x^2}=\frac12$$。`;
  for(let length=1;length<=text.length;length++)assert.equal(typeof renderMathText(text.slice(0,length)),'string');
  assert.match(renderMathText('[课程资料](https://example.com/math)'),/<a href="https:\/\/example.com\/math">课程资料<\/a>/);
});
test('malformed math stays readable and generated markup cannot inject HTML',()=>{
  assert.match(renderMathText(String.raw`$\frac{1}{$`),/公式暂时无法排版/);
  const html=renderMathText('<img src=x onerror="window.DshLearning.postMessage(1)"><script>alert(1)</script>');
  assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;/);
  assert.doesNotMatch(renderMathText('[x](javascript:alert(1))'),/href=/);
});
