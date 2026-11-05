import {useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,RotateCcw,Eye,EyeOff,Trash2,ChevronDown,Check,LocateFixed} from 'lucide-react';
import {compileExpression,panBy,zoomAt,ticks,validDomain} from './math.mjs';
import {Store,useStored} from './store';
import {send} from './bridge';
import {ParameterControls} from './ParameterControls';
import type {FunctionSpec,FunctionEntry,Parameter} from './types';

const palette=['#0e8a4a','#d8683e','#29816e','#a15abd','#b07813','#277caa'];
type View={x:number[];y:number[]};
const format=(n:number)=>!Number.isFinite(n)?'未定义':Math.abs(n)>=1e5||(Math.abs(n)>0&&Math.abs(n)<0.001)?n.toExponential(1):Number(n.toPrecision(4)).toString();
export function FunctionPlot({spec,fullScreen=false}:{spec:FunctionSpec;fullScreen?:boolean}) {
  const {flush}=useContext(Store);
  const initial=useMemo(()=>({x:validDomain(spec.xDomain),y:validDomain(spec.yDomain)}),[spec]);
  const [functions,setFunctions]=useStored<FunctionEntry[]>('functions',spec.functions.slice(0,8).map((f,i)=>({...f,id:f.id||`f${i}`,visible:f.visible!==false,color:palette[i%palette.length]})));
  const [parameters,setParameters]=useStored<Parameter[]>('parameters',(spec.parameters||[]).slice(0,12));
  const [view,setView]=useStored<View>('view',initial);
  const [openId,setOpenId]=useState<string|null>(null),[point,setPoint]=useState<number|null>(null);
  const [newParameter,setNewParameter]=useState(''),[parameterError,setParameterError]=useState('');
  const plot=useRef<HTMLDivElement>(null),[width,setWidth]=useState(320);
  const pointers=useRef(new Map<number,{x:number;y:number}>()),dragged=useRef(false);
  const viewRef=useRef(view);viewRef.current=view;
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));if(plot.current)observer.observe(plot.current);return()=>observer.disconnect();},[]);
  const height=fullScreen?Math.max(300,Math.min(600,window.innerHeight*.55)):Math.max(280,Math.min(380,width*.72));
  const margin={left:48,right:16,top:20,bottom:36},pw=Math.max(1,width-margin.left-margin.right),ph=height-margin.top-margin.bottom;
  const scope=Object.fromEntries(parameters.map(p=>[p.name,p.value]));
  const compiled=useMemo(()=>functions.map(f=>{try{return {f,fn:compileExpression(f.expression,parameters.map(p=>p.name)),error:null};}catch(e){return {f,fn:null,error:(e as Error).message};}}),[functions,parameters.map(p=>p.name).join(',')]);
  const sx=(x:number)=>margin.left+(x-view.x[0])/(view.x[1]-view.x[0])*pw;
  const sy=(y:number)=>margin.top+(view.y[1]-y)/(view.y[1]-view.y[0])*ph;
  const lines=compiled.map(({f,fn,error})=>{
    if(!fn||f.visible===false)return {f,path:'',error};
    let path='',previousY:number|null=null,pen=false;
    const count=Math.min(1200,Math.max(240,Math.round(pw*1.5)));
    for(let i=0;i<=count;i++){
      const x=view.x[0]+(view.x[1]-view.x[0])*i/count,y=fn(x,scope),py=sy(y);
      // Break across poles and values far offscreen; never connect through a discontinuity.
      if(!Number.isFinite(y)||Math.abs(py)>height*8||(previousY!==null&&Math.abs(py-previousY)>ph*1.5)){pen=false;previousY=null;continue;}
      path+=`${pen?'L':'M'}${sx(x).toFixed(2)},${py.toFixed(2)}`;pen=true;previousY=py;
    }return {f,path,error};
  });
  const zoom=useCallback((factor:number,anchor={x:.5,y:.5})=>setView(zoomAt(viewRef.current,factor,anchor)),[setView]);
  const anchor=(clientX:number,clientY:number)=>{const rect=plot.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(clientX-rect.left-margin.left)/pw)),y:Math.max(0,Math.min(1,1-(clientY-rect.top-margin.top)/ph))};};
  useEffect(()=>{const el=plot.current;if(!el)return;const wheel=(event:WheelEvent)=>{event.preventDefault();const rect=el.getBoundingClientRect();zoomAtWheel(Math.exp(Math.max(-.5,Math.min(.5,event.deltaY*.002))),{x:(event.clientX-rect.left-margin.left)/pw,y:1-(event.clientY-rect.top-margin.top)/ph});};const zoomAtWheel=(factor:number,p:{x:number;y:number})=>setView(zoomAt(viewRef.current,factor,p));el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[pw,ph,setView]);
  function down(event:React.PointerEvent){if(event.button!==0)return;plot.current?.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});dragged.current=false;send({type:'gesture',active:true});}
  function move(event:React.PointerEvent){
    const old=pointers.current.get(event.pointerId);if(!old)return;
    const before=[...pointers.current.values()];pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});const after=[...pointers.current.values()];
    const dx=event.clientX-old.x,dy=event.clientY-old.y;if(Math.abs(dx)+Math.abs(dy)>1)dragged.current=true;
    if(after.length===1)setView(panBy(viewRef.current,dx,dy,pw,ph));
    else if(after.length===2){const midpoint=(p:{x:number;y:number}[])=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});const distance=(p:{x:number;y:number}[])=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);const a=midpoint(before),b=midpoint(after);const panned=panBy(viewRef.current,b.x-a.x,b.y-a.y,pw,ph);const ratio=distance(before)/Math.max(8,distance(after));setView(zoomAt(panned,ratio,anchor(b.x,b.y)));}
  }
  function up(event:React.PointerEvent){if(!dragged.current&&pointers.current.size===1&&event.type!=='pointercancel'){const p=anchor(event.clientX,event.clientY);setPoint(view.x[0]+p.x*(view.x[1]-view.x[0]));}pointers.current.delete(event.pointerId);if(!pointers.current.size){send({type:'gesture',active:false});flush();}}
  function edit(index:number,patch:Partial<FunctionEntry>){setFunctions(functions.map((f,i)=>i===index?{...f,...patch}:f));}
  function addFunction(){if(functions.length>=8)return;const id=`f${Date.now()}`;setFunctions([...functions,{id,expression:'x',visible:true,color:palette[functions.length%palette.length]}]);setOpenId(id);}
  function addParameter(){const name=newParameter.trim();if(!/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/.test(name)||['x','pi','e','tau','sin','cos','tan','sqrt','log','exp'].includes(name)){setParameterError('用字母命名参数，例如 a、b 或 k');return;}if(parameters.some(p=>p.name===name)){setParameterError('这个参数已经存在');return;}setParameters([...parameters,{name,value:1,min:-5,max:5,step:.1}]);setNewParameter('');setParameterError('');}
  function fit(){const values:number[]=[];for(const {f,fn} of compiled){if(!fn||f.visible===false)continue;for(let i=0;i<160;i++){const y=fn(view.x[0]+(view.x[1]-view.x[0])*i/159,scope);if(Number.isFinite(y)&&Math.abs(y)<1e8)values.push(y);}}if(values.length){values.sort((a,b)=>a-b);const lo=values[Math.floor(values.length*.03)],hi=values[Math.floor(values.length*.97)],pad=(hi-lo)*.12||1;setView({...view,y:[lo-pad,hi+pad]});}}
  return <div className="function-component">
    <div className="plot-tools"><span className="gesture-hint">双指缩放，单指移动</span><div className="tool-group"><button className="icon-button" onClick={()=>zoom(.75)} aria-label="放大"><Plus/></button><button className="icon-button" onClick={()=>zoom(1.333)} aria-label="缩小"><Minus/></button><button className="icon-button" onClick={fit} aria-label="适应函数范围"><LocateFixed/></button><button className="icon-button" onClick={()=>{setView(initial);setPoint(null);}} aria-label="恢复视图"><RotateCcw/></button></div></div>
    <div className="function-canvas" data-viewport={JSON.stringify(view)} ref={plot} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={e=>{pointers.current.delete(e.pointerId);if(!pointers.current.size)send({type:'gesture',active:false});}} onDoubleClick={()=>setView(initial)} role="application" aria-label="函数画板，双指缩放，单指移动；也可使用放大和缩小按钮">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={functions.filter(f=>f.visible!==false).map(f=>`y=${f.expression}`).join('；')}>
        <defs><clipPath id="plot-area"><rect x={margin.left} y={margin.top} width={pw} height={ph}/></clipPath></defs>
        {ticks(view.x,width<400?4:7).map((n:number)=><g key={`x${n}`}><line className={n===0?'axis-line':'grid-line'} x1={sx(n)} x2={sx(n)} y1={margin.top} y2={height-margin.bottom}/><text x={sx(n)} y={height-12} textAnchor="middle">{format(n)}</text></g>)}
        {ticks(view.y,5).map((n:number)=><g key={`y${n}`}><line className={n===0?'axis-line':'grid-line'} y1={sy(n)} y2={sy(n)} x1={margin.left} x2={width-margin.right}/><text x={margin.left-10} y={sy(n)+4} textAnchor="end">{format(n)}</text></g>)}
        <text x={width-16} y={height-12} textAnchor="end">x</text><text x={margin.left-10} y={12} textAnchor="end">y</text>
        <g clipPath="url(#plot-area)">{lines.map(({f,path})=><path key={f.id} d={path} fill="none" stroke={f.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>)}{point!==null&&<><line className="probe-line" x1={sx(point)} x2={sx(point)} y1={margin.top} y2={height-margin.bottom}/>{compiled.filter(v=>v.fn&&v.f.visible!==false).map(({f,fn})=>{const y=fn!(point,scope);return Number.isFinite(y)?<circle key={f.id} cx={sx(point)} cy={sy(y)} r="4.5" fill={f.color} stroke="var(--surface)" strokeWidth="2"/>:null;})}</>}</g>
      </svg>
    </div>
    {point!==null&&<div className="point-readout" aria-live="polite"><span>x = {format(point)}</span>{compiled.filter(v=>v.fn&&v.f.visible!==false).map(({f,fn},i)=><span key={f.id}><i style={{background:f.color}}/>f{i+1} = {format(fn!(point,scope))}</span>)}</div>}
    <div className="function-list">{compiled.map(({f,error},index)=><div className="function-entry" key={f.id}>
      <div className="function-row"><button className="icon-button visibility" style={{color:f.color}} onClick={()=>edit(index,{visible:f.visible===false})} aria-label={`${f.visible===false?'显示':'隐藏'}函数 ${index+1}`} aria-pressed={f.visible!==false}>{f.visible===false?<EyeOff/>:<Eye/>}</button><button className="expression-summary" onClick={()=>setOpenId(openId===f.id?null:f.id!)} aria-expanded={openId===f.id}><span className="function-name">f{index+1}(x)</span><span className="expression">{f.expression}</span><ChevronDown className={openId===f.id?'rotated':''}/></button></div>
      {openId===f.id&&<div className="function-editor"><label>函数表达式<input aria-label={`函数 ${index+1} 表达式`} value={f.expression} maxLength={500} onBlur={flush} onChange={e=>edit(index,{expression:e.target.value})} autoCapitalize="off" autoCorrect="off" spellCheck={false}/></label><div className="editor-actions"><span>支持 sin、cos、sqrt、log、π</span><button className="text-button danger" onClick={()=>setFunctions(functions.filter((_,i)=>i!==index))}><Trash2/>删除</button></div></div>}
      {error&&<div className="field-error" role="alert">{error}</div>}
    </div>)}</div>
    <button className="text-button add-function" onClick={addFunction} disabled={functions.length>=8}><Plus/>添加函数{functions.length>=8?'（最多 8 条）':''}</button>
    <div className="parameter-section"><div className="section-title">参数</div><ParameterControls parameters={parameters} onChange={setParameters}/>
      {parameters.length<12&&<form className="add-parameter" onSubmit={e=>{e.preventDefault();addParameter();}}><input aria-label="新参数名称" placeholder="新参数，例如 b" value={newParameter} maxLength={16} onChange={e=>setNewParameter(e.target.value)} autoCapitalize="off"/><button className="icon-button" type="submit" aria-label="添加参数"><Plus/></button></form>}{parameterError&&<div className="field-error" role="alert">{parameterError}</div>}
    </div>
  </div>;
}
