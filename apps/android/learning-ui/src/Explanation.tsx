import {Fragment} from 'react';
import {ArrowDown,ArrowDownUp,BookOpen,Code2,Folder,Layers,Cloud,Shield,Eye,Server,Laptop,Check,Lightbulb} from 'lucide-react';
import {MathText} from './MathText';
import type {ExplanationSpec} from './types';
import './explanation.css';

const icons={book:BookOpen,code:Code2,folder:Folder,layers:Layers,cloud:Cloud,shield:Shield,eye:Eye,server:Server,laptop:Laptop,check:Check,bulb:Lightbulb};
export function Explanation({spec}:{spec:ExplanationSpec}) {
  return <div className={`explanation-content explanation-${spec.layout}`}>
    {!!spec.facts.length&&<dl className="explanation-facts">{spec.facts.map((fact,i)=><div key={i}><dt><MathText text={fact.label} inline/></dt><dd className={`explanation-badge tone-${fact.tone}`}><MathText text={fact.value} inline/></dd></div>)}</dl>}
    {!!spec.items.length&&<div className="explanation-items">{spec.items.map((item,index)=>{
      const Icon=icons[item.icon as keyof typeof icons]||BookOpen,Arrow=item.direction==='both'?ArrowDownUp:ArrowDown;
      return <Fragment key={index}><section className={`explanation-item tone-${item.tone}`}>
        <div className="explanation-item-heading">{spec.layout==='steps'?<span className="explanation-step">{index+1}</span>:<Icon aria-hidden="true"/>}<h3><MathText text={item.title} inline/></h3></div>
        {item.focus&&<div className="explanation-focus"><MathText text={item.focus}/></div>}
        {item.body&&<div className="explanation-body"><MathText text={item.body}/></div>}
      </section>{spec.layout==='flow'&&index<spec.items.length-1&&<div className={`explanation-connector tone-${item.tone}`}><Arrow aria-hidden="true"/>{item.connector&&<span><MathText text={item.connector} inline/></span>}</div>}</Fragment>;
    })}</div>}
    {!!spec.points.length&&<ul className="explanation-points">{spec.points.map((point,i)=><li key={i}><MathText text={point}/></li>)}</ul>}
  </div>;
}
