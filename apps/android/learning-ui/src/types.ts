export type Parameter = {name: string; value: number; min: number; max: number; step?: number};
export type FunctionEntry = {id?: string; expression: string; label?: string; color?: string; visible?: boolean};
type Base = {version?: 1; id?: string; title?: string; description?: string};
export type FunctionSpec = Base & {type:'function'; functions:FunctionEntry[]; parameters?:Parameter[]; xDomain?:[number,number]; yDomain?:[number,number]};
export type DiagramSpec = Base & {type:'diagram'; source:string};
export type ChartSpec = Base & {type:'chart'; chartType?:'line'|'bar'|'scatter'|'pie'; labels?:string[]; series:{name:string; values:number[]|[number,number][]}[]; xLabel?:string; yLabel?:string};
export type QuizSpec = Base & {type:'quiz'; questions:{id?:string; prompt:string; options:string[]; answer:number; explanation:string; hint?:string}[]};
export type MathSpec = Base & {type:'math'; latex:string};
export type TableSpec = Base & {type:'table'; columns:string[]; rows:(string|number|null)[][]};
export type CodeSpec = Base & {type:'code'; language?:string; code:string};
export type HtmlSpec = Base & {type:'html'; html:string};
export type Spec = FunctionSpec|DiagramSpec|ChartSpec|QuizSpec|MathSpec|TableSpec|CodeSpec|HtmlSpec;
export type Theme = {dark?:boolean; reducedMotion?:boolean; fontScale?:number; colors?:Record<string,string>;canAsk?:boolean;fullScreen?:boolean};
export type BridgeEvent = {type:'ready'|'height'|'state'|'ask'|'fullscreen'|'gesture'|'copy'; [key:string]:unknown};
declare global {interface Window {DshLearning?:{postMessage:(message:string)=>void}; DshLearningApp:{mount:(spec:unknown,state?:unknown,theme?:Theme,locale?:string)=>void};}}
