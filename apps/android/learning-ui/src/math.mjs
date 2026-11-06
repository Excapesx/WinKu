import {create, all} from 'mathjs';

const math = create(all, {number:'number', predictable:true});
const functions = new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','sqrt','abs','exp','log','log10','log2','floor','ceil','round','sign','min','max','pow']);
const operators = new Set(['+','-','*','/','^','%']);
const constants = {pi:Math.PI, e:Math.E, tau:2*Math.PI};
/** Convert only an unambiguous arithmetic expression; never evaluate generated content. */
export function expressionToTex(expression) {
  if(typeof expression!=='string'||expression.length>500||!/[a-zA-Z0-9]/.test(expression))throw new Error('Not an arithmetic expression');
  const tree=math.parse(expression.replaceAll('²','^2').replaceAll('³','^3').replaceAll('−','-'));
  let count=0;
  tree.traverse(node=>{
    if(++count>120||!['ConstantNode','SymbolNode','OperatorNode','FunctionNode','ParenthesisNode'].includes(node.type))throw new Error('Unsupported expression');
    if(node.isOperatorNode&&!operators.has(node.op))throw new Error('Unsupported operator');
    if(node.isFunctionNode&&(!node.fn?.isSymbolNode||!functions.has(node.fn.name)))throw new Error('Unsupported function');
    if(node.isSymbolNode&&!functions.has(node.name)&&!/^(?:[a-zA-Z]|pi|infinity)$/.test(node.name))throw new Error('Not a math symbol');
  });
  return tree.toTex({parenthesis:'auto',implicit:'hide'});
}
export function compileExpression(expression, parameterNames = []) {
  if(typeof expression!=='string'||expression.length>500)throw new Error('表达式过长，请控制在 500 字以内');
  const normalized=expression.trim().replace(/^y\s*=\s*/i,'').replaceAll('π','pi').replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll('²','^2').replaceAll('³','^3');
  if(!normalized)throw new Error('请输入函数，例如 sin(x) 或 a*x^2+b');
  const allowed=new Set(['x',...Object.keys(constants),...parameterNames]);
  const tree=math.parse(normalized);
  let count=0;
  tree.traverse(node=>{
    if(++count>120)throw new Error('表达式太复杂，请拆成多个函数');
    if(!['ConstantNode','SymbolNode','OperatorNode','FunctionNode','ParenthesisNode'].includes(node.type))throw new Error('这里只接受数学表达式');
    if(node.isOperatorNode&&!operators.has(node.op))throw new Error('不支持这个运算符');
    if(node.isFunctionNode&&(!node.fn?.isSymbolNode||!functions.has(node.fn.name)))throw new Error('不支持这个函数');
    if(node.isSymbolNode&&!allowed.has(node.name)&&!functions.has(node.name))throw new Error(`未知参数 ${node.name}，请先添加参数`);
  });
  const compiled=tree.compile();
  return (x,parameters={})=>{
    try {const result=compiled.evaluate({...constants,...parameters,x});return typeof result==='number'&&Number.isFinite(result)?result:NaN;}catch{return NaN;}
  };
}
export function validDomain(value,fallback=[-5,5]) {
  return Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)&&value[1]>value[0]&&value[1]-value[0]>=1e-6&&value.every(v=>Math.abs(v)<=1e12)?[...value]:[...fallback];
}
export function zoomAt(view, factor, anchor) {
  const zoom=(domain,p)=>{const length=Math.max(1e-5,Math.min(1e9,(domain[1]-domain[0])*factor));const at=domain[0]+(domain[1]-domain[0])*p;return [at-length*p,at+length*(1-p)];};
  return {x:zoom(view.x,anchor.x),y:zoom(view.y,anchor.y)};
}
export function panBy(view,dx,dy,width,height) {
  const sx=(view.x[1]-view.x[0])*dx/width,sy=(view.y[1]-view.y[0])*dy/height;
  return {x:view.x.map(v=>v-sx),y:view.y.map(v=>v+sy)};
}
export function ticks(domain,max=6) {
  const raw=(domain[1]-domain[0])/max,power=10**Math.floor(Math.log10(raw)),ratio=raw/power,step=(ratio>=5?5:ratio>=2?2:1)*power;
  const out=[];for(let n=Math.ceil(domain[0]/step)*step;n<=domain[1]+step*1e-8&&out.length<30;n+=step)out.push(Math.abs(n)<step*1e-8?0:n);return out;
}
