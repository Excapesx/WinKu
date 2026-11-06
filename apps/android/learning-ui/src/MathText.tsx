import {useMemo} from 'react';
import DOMPurify from 'dompurify';
import {renderMathText,renderMathInline,textbookQuizText} from './math-text.mjs';
import {native,send} from './bridge';
import './math-text.css';

export function MathText({text,quiz=false,inline=false}:{text:string;quiz?:boolean;inline?:boolean}) {
  const html=useMemo(()=>DOMPurify.sanitize((inline?renderMathInline:renderMathText)(quiz?textbookQuizText(text):text),{
    FORBID_TAGS:['script','iframe','object','embed','form','input','button','img','style'],
    FORBID_ATTR:['id','name','src','srcset','xlink:href']
  }),[text,quiz,inline]);
  const Tag=inline?'span':'div';
  return <Tag className="math-text" onClick={event=>{
    const link=event.target instanceof Element?event.target.closest('a'):null;
    if(link&&native()){event.preventDefault();event.stopPropagation();const url=link.getAttribute('href');if(url&&/^https?:\/\//i.test(url))send({type:'link',url});}
  }} dangerouslySetInnerHTML={{__html:html}}/>;
}
