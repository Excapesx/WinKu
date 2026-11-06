import {useContext,useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Copy,Lightbulb,RotateCcw,CheckCheck,X} from 'lucide-react';
import * as echarts from 'echarts/core';
import {LineChart,BarChart,ScatterChart,PieChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,DataZoomComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {MathText} from './MathText';
import {renderFormula} from './math-text.mjs';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import {Store,useStored} from './store';
import {native,send} from './bridge';
import {ZoomSurface} from './ZoomSurface';
import type {Spec,ChartSpec,QuizSpec,DiagramSpec,Theme} from './types';

echarts.use([LineChart,BarChart,ScatterChart,PieChart,GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,SVGRenderer]);
for(const [name,language] of Object.entries({python,javascript,json,kotlin,xml,html:xml,css,bash}))hljs.registerLanguage(name,language);

export function Chart({spec,theme}:{spec:ChartSpec;theme:Theme}) {
  const host=useRef<HTMLDivElement>(null);const [chartState,setChartState]=useStored<any>('chart',{});const initial=useRef(chartState);
  useEffect(()=>{
    if(!host.current)return;const chart=echarts.init(host.current,null,{renderer:'svg'});const color=(name:string)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const pie=spec.chartType==='pie',scatter=spec.chartType==='scatter';
    chart.setOption({animation:!theme.reducedMotion,animationDuration:180,color:['#0e8a4a','#d8683e','#29816e','#a15abd','#b07813'],backgroundColor:'transparent',textStyle:{fontFamily:'system-ui',color:color('--foreground')},tooltip:{trigger:pie||scatter?'item':'axis',renderMode:'richText',confine:true},legend:{bottom:0,textStyle:{color:color('--foreground')},selected:initial.current.selected},grid:pie?undefined:{left:48,right:18,top:30,bottom:66,containLabel:false},xAxis:pie?undefined:{type:scatter?'value':'category',data:scatter?undefined:(spec.labels?.length?spec.labels:spec.series[0]?.values.map((_,i)=>String(i+1))),name:spec.xLabel,nameLocation:'middle',nameGap:28,axisLine:{lineStyle:{color:color('--border')}},axisLabel:{color:color('--muted')},splitLine:{show:false}},yAxis:pie?undefined:{type:'value',name:spec.yLabel,axisLabel:{color:color('--muted')},splitLine:{lineStyle:{color:color('--border')}}},dataZoom:pie?undefined:[{type:'inside',xAxisIndex:0,start:initial.current.start??0,end:initial.current.end??100,zoomOnMouseWheel:true,moveOnMouseMove:true}],series:pie?[{type:'pie',radius:['30%','64%'],center:['50%','45%'],label:{color:color('--foreground')},data:spec.series[0]?.values.map((value,i)=>({name:spec.labels?.[i]||String(i+1),value}))}]:spec.series.map(s=>({name:s.name,type:spec.chartType||'line',data:s.values,symbolSize:7,showSymbol:false,lineStyle:{width:2.5},emphasis:{focus:'series'}}))});
    chart.on('legendselectchanged',(event:any)=>{initial.current={...initial.current,selected:event.selected};setChartState(initial.current);});
    chart.on('datazoom',()=>{const option=chart.getOption() as any;const value=option.dataZoom?.[0];initial.current={...initial.current,start:value?.start,end:value?.end};setChartState(initial.current);});
    const resize=new ResizeObserver(()=>chart.resize());resize.observe(host.current);return()=>{resize.disconnect();chart.dispose();};
  },[spec,theme.dark,theme.reducedMotion]);
  return <div ref={host} className="data-chart" role="img" aria-label={`${spec.title||'交互图表'}：${spec.series.map(s=>s.name).join('、')}`}/>;
}

export function Diagram({spec,theme}:{spec:DiagramSpec;theme:Theme}) {
  const [svg,setSvg]=useState(''),[error,setError]=useState('');
  useEffect(()=>{let active=true;(async()=>{try{const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',maxTextSize:16000,maxEdges:150,suppressErrorRendering:true,theme:theme.dark?'dark':'base',themeVariables:{fontFamily:'system-ui',fontSize:'15px',primaryColor:theme.dark?'#263250':'#eef1ff',primaryTextColor:theme.dark?'#e4e8ef':'#252936',primaryBorderColor:theme.dark?'#6680ce':'#b4c1f4',lineColor:theme.dark?'#8593b0':'#77849e'},flowchart:{htmlLabels:false,curve:'basis'}});const rendered=await mermaid.render(`diagram-${Math.random().toString(36).slice(2)}`,spec.source);if(active){setSvg(rendered.svg);setError('');}}catch{if(active)setError('流程图语法有误，可以查看源码或请 Agent 修正。');}})();return()=>{active=false;};},[spec.source,theme.dark]);
  if(error)return <div className="component-error" role="alert">{error}<pre>{spec.source}</pre></div>;
  return svg?<ZoomSurface height={480}><div className="mermaid-content" dangerouslySetInnerHTML={{__html:svg}}/></ZoomSurface>:<div className="loading-state" role="status">正在绘制流程图…</div>;
}

export function Quiz({spec}:{spec:QuizSpec}) {
  const [saved,setSaved]=useStored<{index:number;answers:Record<string,number>;submitted:Record<string,boolean>}>('quiz',{index:0,answers:{},submitted:{}});
  const [hint,setHint]=useState(false);const {ask,canAsk}=useContext(Store);const index=Math.max(0,Math.min(spec.questions.length-1,saved.index));const question=spec.questions[index],key=question.id||String(index),answer=saved.answers[key],submitted=saved.submitted[key],correct=answer===question.answer;
  const count=spec.questions.filter((q,i)=>saved.submitted[q.id||String(i)]).length;
  const go=(n:number)=>{setHint(false);setSaved({...saved,index:n});};
  return <div className="quiz-component"><div className="quiz-progress"><span>第 {index+1} 题，共 {spec.questions.length} 题</span><span>{count} 题已作答</span></div><div className="quiz-question"><MathText text={question.prompt} quiz/></div><div className="quiz-options" role="radiogroup" aria-label={question.prompt}>{question.options.map((option,i)=><button key={i} role="radio" aria-checked={answer===i} disabled={submitted} className={`quiz-option ${answer===i?'selected':''} ${submitted&&i===question.answer?'correct':''} ${submitted&&answer===i&&!correct?'incorrect':''}`} onClick={()=>setSaved({...saved,answers:{...saved.answers,[key]:i}})}><span className="option-letter">{String.fromCharCode(65+i)}</span><MathText text={option} quiz/>{submitted&&i===question.answer&&<span className="answer-tag">正确答案</span>}{answer===i&&(submitted&&!correct?<X/>:<Check/>)}</button>)}</div>
    {hint&&question.hint&&<div className="hint"><Lightbulb/><MathText text={question.hint} quiz/></div>}
    {submitted?<div className={`answer-feedback ${correct?'is-correct':''}`} aria-live="polite"><div className="feedback-title">{correct?<CheckCheck/>:<Lightbulb/>}{correct?'理解得很好':'再想一想这一点'}</div><MathText text={question.explanation} quiz/>{canAsk&&<button className="text-button" onClick={()=>ask(`请针对这道题继续讲解。题目：${question.prompt}\n我的选择：${question.options[answer]}\n正确答案：${question.options[question.answer]}\n请根据我的理解给一个更直观的例子。`)}>请再举个例子</button>}</div>:<div className="quiz-actions">{question.hint&&<button className="text-button" onClick={()=>setHint(!hint)}><Lightbulb/>{hint?'收起提示':'给我一点提示'}</button>}<button className="primary-button" disabled={answer===undefined} onClick={()=>setSaved({...saved,submitted:{...saved.submitted,[key]:true}})}>检查答案</button></div>}
    <div className="quiz-pagination"><button className="icon-button" disabled={index===0} onClick={()=>go(index-1)} aria-label="上一题"><ChevronLeft/></button><button className="text-button" onClick={()=>{setSaved({index:0,answers:{},submitted:{}});setHint(false);}}><RotateCcw/>重新练习</button><button className="icon-button" disabled={index===spec.questions.length-1} onClick={()=>go(index+1)} aria-label="下一题"><ChevronRight/></button></div>
  </div>;
}

export function MathBlock({latex}:{latex:string}) {return <div className="math-block" dangerouslySetInnerHTML={{__html:renderFormula(latex,true)}}/>;}
export function CodeBlock({code,language='text'}:{code:string;language?:string}) {const [copied,setCopied]=useState(false);const html=hljs.getLanguage(language)?hljs.highlight(code,{language}).value:null;async function copy(){try{if(native())send({type:'copy',text:code});else await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}return <div className="code-block"><div className="code-header"><span>{language}</span><button className="text-button" onClick={copy}>{copied?<Check/>:<Copy/>}{copied?'已复制':'复制'}</button></div><pre>{html?<code dangerouslySetInnerHTML={{__html:html}}/>:<code>{code}</code>}</pre></div>;}
export function TableBlock({columns,rows}:{columns:string[];rows:(string|number|null)[][]}) {const [sort,setSort]=useState<{column:number;direction:1|-1}|null>(null);const ordered=sort?[...rows].sort((a,b)=>{const aa=a[sort.column],bb=b[sort.column];return sort.direction*(typeof aa==='number'&&typeof bb==='number'?aa-bb:String(aa??'').localeCompare(String(bb??''),undefined,{numeric:true}));}):rows;return <div className="table-scroll"><table><thead><tr>{columns.map((column,i)=><th key={i} aria-sort={sort?.column===i?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>setSort({column:i,direction:sort?.column===i&&sort.direction===1?-1:1})}>{column}{sort?.column===i?(sort.direction===1?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{ordered.map((row,i)=><tr key={i}>{columns.map((_,j)=><td key={j}>{row[j]??''}</td>)}</tr>)}</tbody></table></div>;}
export function HtmlBlock({html,dark=false}:{html:string;dark?:boolean}) {
  const frame=useRef<HTMLIFrameElement>(null),loaded=useRef(false),sent=useRef('');
  const render=()=>{const key=JSON.stringify({html,dark});if(!loaded.current||sent.current===key)return;sent.current=key;frame.current?.contentWindow?.postMessage({type:'dsh-html',html,dark},'*');};
  useEffect(render,[html,dark]);
  return <iframe ref={frame} className="html-preview" title="交互内容预览" sandbox="allow-scripts" referrerPolicy="no-referrer" src="sandbox.html" onLoad={()=>{loaded.current=true;render();}}/>;
}
