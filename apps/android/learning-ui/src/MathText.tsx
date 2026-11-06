import {useMemo} from 'react';
import DOMPurify from 'dompurify';
import {renderMathText,textbookQuizText} from './math-text.mjs';
import {native,send} from './bridge';
import './math-text.css';

export function MathText({text,quiz=false}:{text:string;quiz?:boolean}) {
  const html=useMemo(()=>DOMPurify.sanitize(renderMathText(quiz?textbookQuizText(text):text),{
    FORBID_TAGS:['script','iframe','object','embed','form','input','button','img','style'],
    FORBID_ATTR:['id','name','src','srcset','xlink:href']
  }),[text,quiz]);
  return <div className="math-text" onClick={event=>{
    const link=event.target instanceof Element?event.target.closest('a'):null;
    if(link&&native()){event.preventDefault();const url=link.getAttribute('href');if(url&&/^https?:\/\//i.test(url))send({type:'link',url});}
  }} dangerouslySetInnerHTML={{__html:html}}/>;
}
