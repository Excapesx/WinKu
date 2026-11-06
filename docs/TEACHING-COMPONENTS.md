# 学习组件与生成方法

生成规范已内置进 guard 提示词，适用于所有已配置的模型。无需学生编写 JSON、打开网页或安装额外渲染器。

可以直接这样提问：

- 用知识地图解释 Git 从工作区到远程仓库的流程。
- 将这条 C++ 声明按类型、变量和初始化分步拆解。
- 用对照卡解释 HTTP 与 HTTPS 的差异。
- 给我学习目标、起点和能力清单。
- 把极限拆开，在每个因子下方标出它的趋向值及理由。
- 写出化学方程式，并在箭头上标明反应条件。

代码使用带语言的普通围栏，例如 cpp、python、java。显示层负责语法高亮、语言标签、复制和自动换行；不执行代码。

数学支持 underbrace / overbrace 上下括注、overset / underset 步骤说明、xrightarrow 的上下标注。化学使用 mhchem 的 ce 语法，包括元素下标、离子电荷、物态、气体或沉淀符号、反应条件和平衡箭头。标注须准确，长推导用 aligned 分行并为括注留足行距。

结构化讲解使用 type:explanation。layout 为 flow、steps、compare、summary；items 最多 8 个、facts 最多 8 个、points 最多 12 项。默认只给必要的 2–6 项，避免把所有回答装进卡片。body 支持 Markdown、数学和代码；focus 放简短的关键概念。tone 仅支持 neutral/blue/green/purple/amber/red，图标必须来自规定列表。颜色辅助区分，文字仍须说明含义。

以下完整数据与应用预览、模型内置模板使用同一份来源：apps/android/js/packages/plugin-guard/learning-templates.js。外层使用完整的 dsh-visual 围栏，正文必须是有效 JSON；LaTeX 反斜杠需按 JSON 规则转义。math 卡片的 latex 字段不加美元定界符，其他文字里的公式需加定界符。

## 流程与知识地图

展示区域、过程和连接步骤；复杂分支用 diagram / Mermaid。

```dsh-visual
{
  "version": 1,
  "id": "git-flow",
  "type": "explanation",
  "layout": "flow",
  "title": "Git 工作流程总览",
  "items": [
    {
      "title": "工作区",
      "body": "你正在编辑的代码文件。",
      "tone": "blue",
      "icon": "folder",
      "connector": "git add"
    },
    {
      "title": "暂存区",
      "body": "准备提交的修改。",
      "tone": "green",
      "icon": "layers",
      "connector": "git commit"
    },
    {
      "title": "本地仓库",
      "body": "保存提交历史和版本信息。",
      "tone": "purple",
      "icon": "server",
      "connector": "git push / fetch",
      "direction": "both"
    },
    {
      "title": "远程仓库",
      "body": "GitHub 等平台上的远程版本库。",
      "tone": "amber",
      "icon": "cloud"
    }
  ]
}
```

## 分步拆解

解释代码、公式结构或解题步骤；focus 放关键部分，body 说明含义。

```dsh-visual
{
  "version": 1,
  "id": "pointer-parts",
  "type": "explanation",
  "layout": "steps",
  "title": "一句智能指针代码，分两步理解",
  "items": [
    {
      "title": "声明智能指针",
      "focus": "`std::unique_ptr<Widget>`",
      "body": "这是数据类型；变量 `p` 持有对象的唯一所有权。",
      "tone": "blue",
      "icon": "code"
    },
    {
      "title": "创建对象并初始化",
      "focus": "`std::make_unique`",
      "body": "创建对象，再把管理权交给 `p`。",
      "tone": "green",
      "icon": "code"
    }
  ]
}
```

## 并列对照

比较机制、做法或常见误区；文字明确表达差异，颜色只作辅助。

```dsh-visual
{
  "version": 1,
  "id": "http-compare",
  "type": "explanation",
  "layout": "compare",
  "title": "HTTP 与 HTTPS",
  "items": [
    {
      "title": "HTTP：明文传输",
      "focus": "密码：123456 →",
      "body": "中途截获的人可能直接看到密码。",
      "tone": "red",
      "icon": "eye"
    },
    {
      "title": "HTTPS：加密传输",
      "focus": "加密数据 →",
      "body": "中途截获的人通常无法直接读取密码。",
      "tone": "green",
      "icon": "shield"
    }
  ]
}
```

## 学习目标与速记

说明学习条件、目标和知识要点；facts 是短标签，points 是能力清单。

```dsh-visual
{
  "version": 1,
  "id": "git-plan",
  "type": "explanation",
  "layout": "summary",
  "title": "Git 系统学习计划",
  "facts": [
    {
      "label": "学习环境",
      "value": "Ubuntu 22.04",
      "tone": "green"
    },
    {
      "label": "学习起点",
      "value": "有一定基础",
      "tone": "blue"
    },
    {
      "label": "最终目标",
      "value": "独立完成实际工作",
      "tone": "purple"
    }
  ],
  "points": [
    "独立管理 Git 仓库。",
    "使用分支协同开发，解决合并冲突。",
    "理解提交历史，恢复错误修改。"
  ]
}
```

## 数学公式的分项标注

说明每个因子的趋向、依据或含义；标注必须对应真实步骤。

```dsh-visual
{
  "version": 1,
  "id": "limit-annotations",
  "type": "math",
  "title": "把极限拆成三个能识别的因子",
  "description": "当 $x\\to0$ 时，分别观察三个因子。",
  "latex": "\\begin{aligned}\\frac{\\tan(\\tan x)}{\\sin 2x}&=\\underbrace{\\frac{\\tan(\\tan x)}{\\tan x}}_{\\to 1}\\cdot\\underbrace{\\frac{\\tan x}{x}}_{\\to 1}\\\\[1em]&\\qquad\\cdot\\underbrace{\\frac{x}{\\sin 2x}}_{\\to\\frac12}\\end{aligned}"
}
```

## 化学反应与条件

元素、系数、物态、反应条件写进化学方程式；不要把条件当普通上标。

```dsh-visual
{
  "version": 1,
  "id": "water-reaction",
  "type": "math",
  "title": "氢气在氧气中燃烧",
  "latex": "\\ce{2H2(g) + O2(g) ->[\\text{点燃}] 2H2O(l)}"
}
```
