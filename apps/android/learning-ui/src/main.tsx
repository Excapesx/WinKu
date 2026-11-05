import React,{useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,BookOpen,ChartNoAxesCombined,Code2,Expand,GitBranch,HelpCircle,MessageCircle,Minimize,RotateCcw,Sun,Moon,Table2,Variable} from 'lucide-react';
import {FunctionPlot} from './FunctionPlot';
import {Chart,Diagram,Quiz,MathBlock,CodeBlock,TableBlock,HtmlBlock} from './Components';
import {Store,type ArtifactState} from './store';
import {normalizeSpec} from './schema.mjs';
import {examples} from './examples';
import {native,send} from './bridge';
import type {Spec,Theme} from './types';
import 'katex/dist/katex.min.css';
import './style.css';

const titles={function:'函数画板',diagram:'流程图',chart:'交互图表',quiz:'小测验',math:'数学公式',table:'数据表格',code:'代码',html:'交互内容'};
const icons={function:Activity,diagram:GitBranch,chart:ChartNoAxesCombined,quiz:HelpCircle,math:Variable,table:Table2,code:Code2,html:BookOpen};
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="component-error" role="alert">这段内容暂时无法显示，请让 Agent 修正组件数据。</div>:this.props.children;}}
function setTheme(theme:Theme){const el=document.documentElement;el.dataset.theme=theme.dark?'dark':'light';el.dataset.reducedMotion=String(Boolean(theme.reducedMotion));el.style.fontSize=`${16*Math.max(.85,Math.min(2,theme.fontScale||1))}px`;for(const [key,value] of Object.entries(theme.colors||{}))if(/^#[0-9a-f]{6,8}$/i.test(value))el.style.setProperty(`--${key}`,value);}
function localState(key:string):ArtifactState {try{return JSON.parse(localStorage.getItem(`dsh-learning:${key}`)||'{}');}catch{return {};}}
function LearningView({spec,initialState,theme}:{spec:Spec;initialState?:ArtifactState;theme:Theme}) {
  const [state,setState]=useState<ArtifactState>(()=>initialState??(!native()?localState(spec.id||spec.type):{}));
  const [expanded,setExpanded]=useState(false),[notice,setNotice]=useState('');
  const changed=useRef(false),host=useRef<HTMLDivElement>(null);const Icon=icons[spec.type];
  useEffect(()=>{setTheme(theme);},[theme]);
  const latest=useRef(state);latest.current=state;
  const persist=useCallback(()=>{if(!changed.current)return;const snapshot=latest.current;const serialized=JSON.stringify(snapshot);if(serialized.length>48000)return;send({type:'state',state:snapshot});if(!native())try{localStorage.setItem(`dsh-learning:${spec.id||spec.type}`,serialized);}catch{}},[spec.id,spec.type]);
  useEffect(()=>{const timer=setTimeout(persist,250);return()=>clearTimeout(timer);},[state,persist]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)persist();};window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',hidden);};},[persist]);
  useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(()=>send({type:'height',height:Math.ceil(document.documentElement.scrollHeight)}));observer.observe(host.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setExpanded(false);send({type:'fullscreen',expanded:false});}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const store=useMemo(()=>({state,canAsk:theme.canAsk!==false,flush:()=>queueMicrotask(persist),update:(key:string,value:unknown)=>{changed.current=true;setState(old=>({...old,[key]:value}));},ask:(prompt:string)=>{
    if(native()){send({type:'ask',prompt,context:{component:spec.type,title:spec.title,state}});}else{navigator.clipboard?.writeText(prompt).then(()=>setNotice('问题已复制，可粘贴到对话中继续讨论。')).catch(()=>setNotice('这是组件预览；在 DSH 中可继续向 Agent 提问。'));setNotice('这是组件预览；在 DSH 中可继续向 Agent 提问。');}
  }}),[state,spec,theme.canAsk,persist]);
  let content:React.ReactNode;
  switch(spec.type){case 'function':content=<FunctionPlot spec={spec} fullScreen={expanded||theme.fullScreen}/>;break;case 'diagram':content=<Diagram spec={spec} theme={theme}/>;break;case 'chart':content=<Chart spec={spec} theme={theme}/>;break;case 'quiz':content=<Quiz spec={spec}/>;break;case 'math':content=<MathBlock latex={spec.latex}/>;break;case 'table':content=<TableBlock columns={spec.columns} rows={spec.rows}/>;break;case 'code':content=<CodeBlock code={spec.code} language={spec.language}/>;break;case 'html':content=<HtmlBlock html={spec.html} dark={theme.dark}/>;}
  return <Store.Provider value={store}><article ref={host} className={`component-shell ${expanded?'is-expanded':''} ${theme.fullScreen?'native-fullscreen':''}`}>{!theme.fullScreen&&<header className="component-header"><div className="component-heading"><Icon/><h2>{spec.title||titles[spec.type]}</h2></div><button className="icon-button" aria-label={expanded||theme.fullScreen?'退出全屏':'全屏查看'} onClick={()=>{if(native()){send({type:'state',state});send({type:'fullscreen',expanded:!theme.fullScreen});}else setExpanded(!expanded);}}>{expanded||theme.fullScreen?<Minimize/>:<Expand/>}</button></header>}{spec.description&&<p className="component-description">{spec.description}</p>}<div className="component-body">{content}</div>{store.canAsk&&<footer className="component-footer"><button className="text-button" onClick={()=>store.ask('请结合我在这个交互组件中的当前操作和结果，继续解释这个概念。')}><MessageCircle/>结合我的操作讲解</button></footer>}{notice&&<div className="local-notice" role="status">{notice}</div>}</article></Store.Provider>;
}
function Demo(){const chosen=new URLSearchParams(location.search).get('demo')||'function';const [kind,setKind]=useState(Object.hasOwn(examples,chosen)?chosen:'function');const [dark,setDark]=useState(matchMedia('(prefers-color-scheme:dark)').matches);const theme=useMemo(()=>({dark,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches}),[dark]);return <main className="demo-page"><header className="demo-header"><div><BookOpen/><span>交互学习</span></div><button className="icon-button" onClick={()=>setDark(!dark)} aria-label={dark?'浅色模式':'深色模式'}>{dark?<Sun/>:<Moon/>}</button></header><div className="demo-intro"><h1>动手试，慢慢懂。</h1><p>把抽象的概念，变成可以探索的图像。</p></div><label className="component-picker">选择内容<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.keys(examples).map(key=><option key={key} value={key}>{titles[key as keyof typeof titles]}</option>)}</select></label><Boundary key={kind}><LearningView key={kind} spec={normalizeSpec(examples[kind]) as Spec} theme={theme}/></Boundary><div className="demo-note">组件示例可离线运行；对话中的内容由你选择的模型生成。</div></main>;}
const root=createRoot(document.getElementById('root')!);
window.DshLearningApp={mount(input,initialState,theme={},locale='zh-CN'){
  document.documentElement.lang=locale;try{const spec=normalizeSpec(input) as Spec;root.render(<Boundary key={`${spec.id}:${spec.type}`}><LearningView key={`${spec.id}:${spec.type}`} spec={spec} initialState={(initialState&&typeof initialState==='object'?initialState:{}) as ArtifactState} theme={theme}/></Boundary>);}catch(e){root.render(<div className="component-error" role="alert">{(e as Error).message}</div>);}
}};
if(!native())root.render(<Demo/>);else send({type:'ready'});
