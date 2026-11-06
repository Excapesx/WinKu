import {useLayoutEffect,useMemo,useRef,useEffect,type MouseEvent,type UIEvent} from 'react';
import {renderCodeBlock} from './code-block.mjs';
import {native,send} from './bridge';
import './code-block.css';

type CodeState={wrap:boolean;left:number;top:number;copiedUntil:number};
/** Preserve viewing choices when streamed Markdown replaces its highlighted HTML. */
export function useCodeActions() {
  const root=useRef<HTMLElement|null>(null),states=useRef(new Map<number,CodeState>());
  const timers=useRef(new Set<ReturnType<typeof setTimeout>>());
  const blocks=()=>Array.from(root.current?.querySelectorAll<HTMLElement>('.code-block')||[]);
  function apply(block:HTMLElement,state:CodeState){
    block.dataset.wrap=String(state.wrap);
    block.querySelector('[data-code-action="wrap"]')?.setAttribute('aria-pressed',String(state.wrap));
    const copied=state.copiedUntil>Date.now(),button=block.querySelector<HTMLElement>('[data-code-action="copy"]');
    if(button){button.dataset.copied=String(copied);button.setAttribute('aria-label',copied?'已复制代码':'复制代码');}
    const pre=block.querySelector('pre');if(pre){pre.scrollLeft=state.wrap?0:state.left;pre.scrollTop=state.top;}
  }
  useLayoutEffect(()=>{blocks().forEach((block,index)=>{const state=states.current.get(index);if(state)apply(block,state);});});
  useEffect(()=>()=>{for(const timer of timers.current)clearTimeout(timer);},[]);
  function onScrollCapture(event:UIEvent<HTMLElement>){
    if(!(event.target instanceof HTMLElement)||event.target.tagName!=='PRE')return;
    const block=event.target.closest<HTMLElement>('.code-block');if(!block)return;
    const index=blocks().indexOf(block);if(index<0)return;
    states.current.set(index,{wrap:block.dataset.wrap==='true',left:event.target.scrollLeft,top:event.target.scrollTop,copiedUntil:states.current.get(index)?.copiedUntil||0});
  }
  function onCodeClick(event:MouseEvent<HTMLElement>){
    const button=event.target instanceof Element?event.target.closest<HTMLElement>('button[data-code-action]'):null;
    const block=button?.closest<HTMLElement>('.code-block');
    if(!button||!block||!root.current?.contains(block))return false;
    event.preventDefault();event.stopPropagation();
    const index=blocks().indexOf(block),pre=block.querySelector('pre');
    const state=states.current.get(index)||{wrap:false,left:pre?.scrollLeft||0,top:pre?.scrollTop||0,copiedUntil:0};
    if(button.dataset.codeAction==='wrap'){
      state.wrap=!state.wrap;states.current.set(index,state);apply(block,state);return true;
    }
    const text=block.querySelector('pre code')?.textContent||'';
    void (async()=>{try{
      if(native())send({type:'copy',text});else await navigator.clipboard.writeText(text);
      state.copiedUntil=Date.now()+1800;states.current.set(index,state);apply(block,state);
      const status=block.querySelector('.code-status');if(status)status.textContent='已复制代码';
      const timer=setTimeout(()=>{timers.current.delete(timer);const current=blocks()[index],saved=states.current.get(index);if(current&&saved)apply(current,saved);},1850);timers.current.add(timer);
    }catch{button.setAttribute('aria-label','复制失败，请重试');}})();
    return true;
  }
  return {root,onCodeClick,onScrollCapture};
}
export function CodeBlock({code,language=''}:{code:string;language?:string}) {
  const html=useMemo(()=>renderCodeBlock(code,language),[code,language]);
  const markup=useMemo(()=>({__html:html}),[html]);
  const {root,onCodeClick,onScrollCapture}=useCodeActions();
  return <div className="code-view" ref={node=>{root.current=node;}} onClick={onCodeClick} onScrollCapture={onScrollCapture} dangerouslySetInnerHTML={markup}/>;
}
