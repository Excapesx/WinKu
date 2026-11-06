import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import yaml from 'highlight.js/lib/languages/yaml';
import swift from 'highlight.js/lib/languages/swift';

const languages={cpp,c,python,javascript,typescript,java,kotlin,json,xml,css,bash,sql,rust,go,yaml,swift};
for(const [name,grammar] of Object.entries(languages))hljs.registerLanguage(name,grammar);
const aliases={ 'c++':'cpp',cc:'cpp',cxx:'cpp',hpp:'cpp',h:'c',py:'python',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',kt:'kotlin',html:'xml',htm:'xml',sh:'bash',shell:'bash',zsh:'bash',yml:'yaml',golang:'go',rs:'rust',text:'plaintext',txt:'plaintext',plain:'plaintext' };
const labels={cpp:'C++',c:'C',python:'Python',javascript:'JavaScript',typescript:'TypeScript',java:'Java',kotlin:'Kotlin',json:'JSON',xml:'XML',css:'CSS',bash:'Shell',sql:'SQL',rust:'Rust',go:'Go',yaml:'YAML',swift:'Swift',plaintext:'代码'};
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
export function highlightedCode(code,info='') {
  const token=info.trim().split(/\s+/)[0].toLowerCase().replace(/^language-/, '');
  const language=Object.hasOwn(aliases,token)?aliases[token]:(/^[a-z0-9_+.#-]{1,30}$/.test(token)?token:'plaintext');
  const label=token==='html'||token==='htm'?'HTML':(Object.hasOwn(labels,language)?labels[language]:token);
  const key=language+'\0'+code;
  let html=cache.get(key);
  if(html===undefined){
    html=escape(code);
    if(code.length<=32_000)try{if(hljs.getLanguage(language))html=hljs.highlight(code,{language,ignoreIllegals:true}).value;}catch{}
    cache.set(key,html);if(cache.size>32)cache.delete(cache.keys().next().value);
  }
  return {language,label,html};
}
const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const codeIcon=svg('<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>');
const wrapIcon=svg('<path d="M3 6h18M3 12h13a4 4 0 0 1 0 8h-4m3-3-3 3 3 3M3 18h4"/>');
const copyIcon=svg('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>');
const checkIcon=svg('<path d="m5 12 4 4L19 6"/>');
export function renderCodeBlock(code,info='') {
  const {language,label,html}=highlightedCode(code,info);
  return `<section class="code-block" data-wrap="false"><div class="code-header"><span class="code-language">${codeIcon}<span>${escape(label)}</span></span><div class="code-actions"><button type="button" class="code-action" data-code-action="wrap" aria-label="自动换行" aria-pressed="false" title="自动换行">${wrapIcon}</button><button type="button" class="code-action" data-code-action="copy" aria-label="复制代码" title="复制代码"><span class="code-copy-icon">${copyIcon}</span><span class="code-check-icon">${checkIcon}</span></button><span class="code-status" aria-live="polite"></span></div></div><pre tabindex="0" aria-label="${escape(label)}代码"><code class="language-${escape(language)}">${html}</code></pre></section>`;
}
