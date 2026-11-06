import {Marked} from 'marked';
import katex from 'katex';
import {expressionToTex} from './math.mjs';

const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderFormula(latex,displayMode=false) {
  let source=latex.trim();
  // Legacy answers often contain ASCII ratios even inside math delimiters.
  // Parse a complete arithmetic expression, rather than guessing fraction boundaries in prose.
  if(source.includes('/')&&!source.includes('\\'))try{source=expressionToTex(source);}catch{}
  if(/^\\infty\s*\/\s*\\infty$/.test(source))source='\\frac{\\infty}{\\infty}';
  if(!displayMode&&/\\frac\b/.test(source))source='\\displaystyle '+source;
  try{return katex.renderToString(source,{displayMode,throwOnError:true,trust:false,maxExpand:200,maxSize:20,strict:'ignore'});}
  catch{return '<span class="math-error" role="status">公式暂时无法排版</span>';}
}

function mathToken(source,block=false) {
  const pairs=block?[['$$','$$'],['\\[','\\]']]:[['$$','$$'],['\\[','\\]'],['\\(','\\)'],['$','$']];
  for(const [open,close] of pairs){
    if(!source.startsWith(open))continue;
    const start=open.length;let end=start;
    while((end=source.indexOf(close,end))>=0){
      let slashes=0;for(let i=end-1;i>=0&&source[i]==='\\';i--)slashes++;
      if(slashes%2===0)break;end+=close.length;
    }
    if(end<0){
      // During streaming, keep incomplete TeX out of the student's reading text.
      if(open!=='$'||/^\$[A-Za-z\\]/.test(source))return {type:block?'mathBlock':'mathInline',raw:source,latex:'',pending:true,display:open!=='$'&&open!=='\\('};
      return;
    }
    const body=source.slice(start,end);
    if(!body.trim()||body.length>12000||body.includes('\n\n'))return;
    if(open==='$'&&(/^\s|\s$/.test(body)||/\d/.test(source[end+1]||'')))return;
    return {type:block?'mathBlock':'mathInline',raw:source.slice(0,end+close.length),latex:body,display:open!=='$'&&open!=='\\('};
  }
}
const renderMath=token=>{
  if(token.pending)return '<span class="math-pending" aria-busy="true">公式排版中…</span>';
  const tag=token.type==='mathBlock'?'div':'span';
  const display=token.display||/\\displaystyle\b/.test(token.latex)||(token.latex.length>70&&/\\(?:frac|lim)\b/.test(token.latex));
  return `<${tag} class="${display?'math-display':'math-inline'}">${renderFormula(token.latex,display)}</${tag}>`;
};
const parser=new Marked({gfm:true,breaks:false,renderer:{html:({text})=>escape(text),image:({text})=>escape(text),link:function({tokens,href}){
  const label=this.parser.parseInline(tokens);
  return /^https?:\/\//i.test(href)?`<a href="${escape(href)}">${label}</a>`:label;
}}});
parser.use({extensions:[
  {name:'mathBlock',level:'block',start:src=>src.search(/(?:\$\$|\\\[)/),tokenizer:src=>mathToken(src,true),renderer:renderMath},
  {name:'mathInline',level:'inline',start:src=>src.search(/\$|\\[([]/),tokenizer:src=>mathToken(src),renderer:renderMath},
  // CommonMark punctuation rules can leave **“中文”** adjacent to Chinese as literal stars.
  {name:'cjkStrong',level:'inline',start:src=>src.indexOf('**'),tokenizer(src){const m=/^\*\*([^*\n]+?)\*\*/.exec(src);if(m)return {type:'cjkStrong',raw:m[0],tokens:this.lexer.inlineTokens(m[1])};},renderer(token){return `<strong>${this.parser.parseInline(token.tokens)}</strong>`;}}
]});
export function renderMathText(text){return parser.parse(text,{async:false});}

/** Old quiz payloads used e.g. lim(x→0) (e^x - 1 - x)/x² 等于?. */
export function textbookQuizText(text){
  if(/\$|\\[([]/.test(text))return text;
  const limit=/lim\(\s*([a-zA-Z])\s*(?:→|->)\s*(-?\d+(?:\.\d+)?)([+-]?)\s*\)\s*([a-zA-Z0-9π()^²³+*/. −-]+?)(?=[\u3400-\u9fff?？=]|$)/g;
  const converted=text.replace(limit,(raw,variable,target,side,expression)=>{
    try{return `$$\\lim_{${variable}\\to ${target}${side?`^{${side}}`:''}}${expressionToTex(expression.trim())}$$`;}
    catch{return raw;}
  });
  if(converted!==text)return converted;
  // A numeric/arithmetic option, not an arbitrary sentence, URL, date or unit label.
  if(/^[−-]?(?:\d+|[a-zA-Z])\s*\/\s*(?:\d+|[a-zA-Z])(?:\^[0-9]+|[²³])?$/.test(text.trim())){
    try{return `$${expressionToTex(text)}$`;}catch{}
  }
  return text;
}
