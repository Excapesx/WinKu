/** Examples shared by the shipped generation guide, gallery and validation tests. */
export const learningTemplates = [
  {name:'流程与知识地图',when:'展示区域、过程和连接步骤；复杂分支用 diagram / Mermaid。',spec:{version:1,id:'git-flow',type:'explanation',layout:'flow',title:'Git 工作流程总览',items:[
    {title:'工作区',body:'你正在编辑的代码文件。',tone:'blue',icon:'folder',connector:'git add'},
    {title:'暂存区',body:'准备提交的修改。',tone:'green',icon:'layers',connector:'git commit'},
    {title:'本地仓库',body:'保存提交历史和版本信息。',tone:'purple',icon:'server',connector:'git push / fetch',direction:'both'},
    {title:'远程仓库',body:'GitHub 等平台上的远程版本库。',tone:'amber',icon:'cloud'}
  ]}},
  {name:'分步拆解',when:'解释代码、公式结构或解题步骤；focus 放关键部分，body 说明含义。',spec:{version:1,id:'pointer-parts',type:'explanation',layout:'steps',title:'一句智能指针代码，分两步理解',items:[
    {title:'声明智能指针',focus:'`std::unique_ptr<Widget>`',body:'这是数据类型；变量 `p` 持有对象的唯一所有权。',tone:'blue',icon:'code'},
    {title:'创建对象并初始化',focus:'`std::make_unique`',body:'创建对象，再把管理权交给 `p`。',tone:'green',icon:'code'}
  ]}},
  {name:'并列对照',when:'比较机制、做法或常见误区；文字明确表达差异，颜色只作辅助。',spec:{version:1,id:'http-compare',type:'explanation',layout:'compare',title:'HTTP 与 HTTPS',items:[
    {title:'HTTP：明文传输',focus:'密码：123456 →',body:'中途截获的人可能直接看到密码。',tone:'red',icon:'eye'},
    {title:'HTTPS：加密传输',focus:'加密数据 →',body:'中途截获的人通常无法直接读取密码。',tone:'green',icon:'shield'}
  ]}},
  {name:'学习目标与速记',when:'说明学习条件、目标和知识要点；facts 是短标签，points 是能力清单。',spec:{version:1,id:'git-plan',type:'explanation',layout:'summary',title:'Git 系统学习计划',facts:[
    {label:'学习环境',value:'Ubuntu 22.04',tone:'green'},
    {label:'学习起点',value:'有一定基础',tone:'blue'},
    {label:'最终目标',value:'独立完成实际工作',tone:'purple'}
  ],points:['独立管理 Git 仓库。','使用分支协同开发，解决合并冲突。','理解提交历史，恢复错误修改。']}},
  {name:'数学公式的分项标注',when:'说明每个因子的趋向、依据或含义；标注必须对应真实步骤。',spec:{version:1,id:'limit-annotations',type:'math',title:'把极限拆成三个能识别的因子',description:String.raw`当 $x\to0$ 时，分别观察三个因子。`,latex:String.raw`\begin{aligned}\frac{\tan(\tan x)}{\sin 2x}&=\underbrace{\frac{\tan(\tan x)}{\tan x}}_{\to 1}\cdot\underbrace{\frac{\tan x}{x}}_{\to 1}\\[1em]&\qquad\cdot\underbrace{\frac{x}{\sin 2x}}_{\to\frac12}\end{aligned}`}},
  {name:'化学反应与条件',when:'元素、系数、物态、反应条件写进化学方程式；不要把条件当普通上标。',spec:{version:1,id:'water-reaction',type:'math',title:'氢气在氧气中燃烧',latex:String.raw`\ce{2H2(g) + O2(g) ->[\text{点燃}] 2H2O(l)}`}}
];

export const learningGenerationGuide=String.raw`
## How to generate teaching components
Choose the smallest useful format, then emit a complete dsh-visual fence containing valid JSON.
Never ask the learner to copy JSON, install a renderer, open an HTML file or run code to see the card.
Use explanation for structured teaching: layout flow / steps / compare / summary.
items accepts title, body (Markdown + math), focus (a short highlighted concept), tone, icon,
connector (the label AFTER this item in a flow), direction down / both. Use 2–6 items, maximum 8.
facts accepts label/value/tone, maximum 8. points is a short bullet list, maximum 12.
Use tones neutral / blue / green / purple / amber / red. Supported icons: book, code, folder,
layers, cloud, shield, eye, server, laptop, check, bulb. Do not invent fields, colors, SVG or scripts.
Use consistent colors to tie the same concept together; include text labels so color is not essential.
On a narrow phone, use short titles and concise bodies. One useful card is better than many boxes.

## Annotations on formulas and chemical equations
Use \underbrace{expression}_{\to 1} for a factor's limiting value and \overbrace{expression}^{meaning}
for a group explanation. Use \overset{\text{reason}}{=} or \xrightarrow[\text{below}]{\text{above}}
for a justified step. \underbrace, \overbrace, \overset, \underset and labelled arrows work in ordinary
math delimiters and math cards. Keep Chinese labels inside \text{...}. Split long derivations with
aligned, preserving the same expression and its annotation together. Do not invent a limit or condition.
Chemistry uses mhchem: \ce{...} for substances, ionic charges, coefficients, physical states and
reaction arrows. Conditions belong above/below the reaction arrow, e.g. ->[\Delta] or
->[\text{点燃}]. Reversible reactions can use <=>. Verify balancing and the conditions before responding.
In prose use $...$ / $$...$$; the latex field of a math card has NO dollar delimiters.
JSON.stringify-style escaping is required: each LaTeX backslash becomes a doubled backslash in JSON.

## Code presentation
Use an ordinary fenced code block with a language identifier (cpp, c, python, java, javascript,
typescript, kotlin, sql, json, html, css, bash, rust, go, swift, yaml). Code is highlighted locally
with a language label, copy and line-wrap controls. Preserve original indentation; do not embed
HTML spans or ANSI color escapes. Explain the important tokens in a steps card when useful.

## Complete, directly renderable examples
` + learningTemplates.map(example=>example.name+': '+example.when+'\n```dsh-visual\n'+JSON.stringify(example.spec)+'\n```').join('\n\n');
