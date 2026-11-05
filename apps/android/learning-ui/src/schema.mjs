const text=(v,max=20000)=>typeof v==='string'?v.slice(0,max):'';
const finite=(v,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const names=/^[A-Za-z][A-Za-z0-9_]{0,15}$/;
const reserved=new Set(['x','pi','e','tau','constructor','prototype','__proto__','sin','cos','tan','sqrt','log','exp','abs','min','max']);
export function normalizeSpec(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('组件内容必须是一个对象');
  if(input.version!==undefined&&input.version!==1)throw new Error('这个组件版本暂不支持');
  const base={version:1,id:text(input.id,100),title:text(input.title,160),description:text(input.description,1000)};
  switch(input.type){
    case 'function':{
      if(!Array.isArray(input.functions)||input.functions.length>8)throw new Error('请提供 1 到 8 个函数');
      const parameters=(Array.isArray(input.parameters)?input.parameters:[]).slice(0,12).map(p=>{
        const name=text(p?.name,16);if(!names.test(name)||reserved.has(name))throw new Error('参数名称无效');
        const min=finite(p.min,-5),max=finite(p.max,5);if(max<=min||Math.max(Math.abs(min),Math.abs(max))>1e9)throw new Error('参数范围无效');
        return {name,min,max,value:Math.max(min,Math.min(max,finite(p.value,1))),step:Math.max((max-min)/10000,Math.min(max-min,finite(p.step,.1)))};
      });
      if(new Set(parameters.map(p=>p.name)).size!==parameters.length)throw new Error('参数名称不能重复');
      return {...base,type:'function',functions:input.functions.map((f,i)=>({id:`f${i}`,expression:text(f?.expression,500),label:text(f?.label,100),visible:f?.visible!==false})),parameters,xDomain:input.xDomain,yDomain:input.yDomain};
    }
    case 'diagram':return {...base,type:'diagram',source:text(input.source,16000)};
    case 'math':return {...base,type:'math',latex:text(input.latex,12000)};
    case 'code':return {...base,type:'code',language:text(input.language,30),code:text(input.code,100000)};
    case 'html':return {...base,type:'html',html:text(input.html,100000)};
    case 'table':{
      if(!Array.isArray(input.columns)||!Array.isArray(input.rows))throw new Error('表格缺少列或行');
      const columns=input.columns.slice(0,20).map(c=>text(c,200));
      return {...base,type:'table',columns,rows:input.rows.slice(0,200).map(r=>columns.map((_,i)=>typeof r?.[i]==='number'?finite(r[i]):text(r?.[i],2000)))};
    }
    case 'chart':{
      if(!Array.isArray(input.series))throw new Error('图表缺少数据序列');
      return {...base,type:'chart',chartType:['bar','scatter','pie'].includes(input.chartType)?input.chartType:'line',labels:Array.isArray(input.labels)?input.labels.slice(0,2000).map(s=>String(s).slice(0,100)):[],xLabel:text(input.xLabel,100),yLabel:text(input.yLabel,100),series:input.series.slice(0,8).map(s=>({name:text(s?.name,100),values:(Array.isArray(s?.values)?s.values:[]).slice(0,2000).map(v=>Array.isArray(v)?[finite(v[0]),finite(v[1])]:finite(v))}))};
    }
    case 'quiz':{
      if(!Array.isArray(input.questions)||!input.questions.length)throw new Error('小测验至少需要一道题');
      return {...base,type:'quiz',questions:input.questions.slice(0,20).map((q,i)=>{
        if(!q||!Array.isArray(q.options)||q.options.length<2||q.options.length>8||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)throw new Error('题目的选项或答案无效');
        return {id:`q${i}`,prompt:text(q.prompt,2000),options:q.options.map(o=>text(o,2000)),answer:q.answer,explanation:text(q.explanation,5000),hint:text(q.hint,2000)};
      })};
    }
    default:throw new Error('暂不支持这个组件类型');
  }
}
