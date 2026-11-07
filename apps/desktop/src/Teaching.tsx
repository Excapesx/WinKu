import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Activity,
  ChartNoAxesCombined,
  Code2,
  Expand,
  GitBranch,
  HelpCircle,
  Minimize,
  BookOpen,
  MessageCircle,
  Table2,
  Variable,
} from "lucide-react";
import { MathText } from "../../android/learning-ui/src/MathText";
import { FunctionPlot } from "../../android/learning-ui/src/FunctionPlot";
import {
  Chart,
  Diagram,
  Quiz,
  MathBlock,
  CodeBlock,
  TableBlock,
  HtmlBlock,
} from "../../android/learning-ui/src/Components";
import { Explanation } from "../../android/learning-ui/src/Explanation";
import { Store } from "../../android/learning-ui/src/store";
import { normalizeSpec } from "../../android/learning-ui/src/schema.mjs";
import type { Spec } from "../../android/learning-ui/src/types";
import type { Session } from "./api";
import { request } from "./api";
import { parseRichContent } from "./rich-content.mjs";
// Match the Android LearningView vocabulary, including formula-aware card titles.
const titles = {
  function: "函数画板",
  diagram: "流程图",
  chart: "交互图表",
  quiz: "小测验",
  math: "数学公式",
  table: "数据表格",
  code: "代码",
  html: "交互内容",
  explanation: "学习讲解",
  markdown: "学习讲解",
};
const icons = {
  function: Activity,
  diagram: GitBranch,
  chart: ChartNoAxesCombined,
  quiz: HelpCircle,
  math: Variable,
  table: Table2,
  code: Code2,
  html: BookOpen,
  explanation: BookOpen,
  markdown: BookOpen,
};
// A regenerated card with different questions must not inherit old quiz answers.
function specKey(spec: Spec) {
  let hash = 2166136261;
  for (const c of JSON.stringify(spec))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="component-error">
        这段组件数据无法显示，请让 WinKu 修正。
      </p>
    ) : (
      this.props.children
    );
  }
}
function Artifact({
  spec,
  session,
  id,
  dark,
  ask,
  canAsk,
}: {
  spec: Spec;
  session: Session;
  id: string;
  dark: boolean;
  ask: (text: string) => void;
  canAsk: boolean;
}) {
  const [state, setState] = useState(session.artifacts?.[id] ?? {}),
    [expanded, setExpanded] = useState(false),
    [error, setError] = useState("");
  const shell = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [
      ...(shell.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
      ) ?? []),
    ];
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      }
      if (event.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [expanded]);
  const store = useMemo(
    () => ({
      state,
      canAsk,
      flush: () => {},
      ask: (text: string) =>
        ask(
          text +
            "\n组件：" +
            (spec.title ?? spec.type) +
            "\n当前操作：" +
            JSON.stringify(state),
        ),
      update: (key: string, value: any) =>
        setState((old: any) => {
          const next = { ...old, [key]: value };
          request("artifact.save", {
            sessionId: session.id,
            id,
            value: next,
          }).catch((e) => setError(String(e)));
          return next;
        }),
    }),
    [state, canAsk, session.id, id, ask],
  );
  const theme = {
    dark,
    reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches,
  };
  const Icon = icons[spec.type];
  let content;
  switch (spec.type) {
    case "function":
      content = <FunctionPlot spec={spec} fullScreen={expanded} />;
      break;
    case "chart":
      content = <Chart spec={spec} theme={theme} />;
      break;
    case "diagram":
      content = <Diagram spec={spec} theme={theme} />;
      break;
    case "quiz":
      content = <Quiz spec={spec} />;
      break;
    case "math":
      content = <MathBlock latex={spec.latex} />;
      break;
    case "code":
      content = <CodeBlock code={spec.code} language={spec.language} />;
      break;
    case "table":
      content = <TableBlock columns={spec.columns} rows={spec.rows} />;
      break;
    case "explanation":
      content = <Explanation spec={spec} />;
      break;
    case "html":
      content = <HtmlBlock html={spec.html} dark={dark} />;
      break;
    case "markdown":
      content = <MathText text={spec.text} />;
  }
  return (
    <Store.Provider value={store}>
      <section
        ref={shell}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? spec.title || titles[spec.type] : undefined}
        className={"component-shell " + (expanded ? "desktop-expanded" : "")}
        onKeyDown={(e) => {
          if (e.key === "Escape") setExpanded(false);
        }}
      >
        <header className="component-header">
          <div className="component-heading">
            <Icon />
            <h2>
              <MathText text={spec.title || titles[spec.type]} inline />
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label={expanded ? "退出全屏" : "全屏查看"}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize /> : <Expand />}
          </button>
        </header>
        {spec.description && (
          <div className="component-description">
            <MathText text={spec.description} />
          </div>
        )}
        <div className="component-body">{content}</div>
        <footer className="component-footer">
          <button
            className="text-button"
            disabled={!canAsk}
            onClick={() =>
              store.ask(
                "请结合我在这个交互组件中的当前操作和结果，继续解释这个概念。",
              )
            }
          >
            <MessageCircle />
            结合我的操作讲解
          </button>
        </footer>
        {error && (
          <p className="error" role="alert">
            组件状态未保存：{error}
          </p>
        )}
      </section>
    </Store.Provider>
  );
}
export function Teaching({
  text,
  session,
  messageId,
  dark,
  ask,
  canAsk,
}: {
  text: string;
  session: Session;
  messageId: string;
  dark: boolean;
  ask: (text: string) => void;
  canAsk: boolean;
}) {
  const parts = useMemo<
    { text?: string; spec?: Spec; error?: string }[]
  >(() => {
    return parseRichContent(text).map((part) => {
      if (!part.spec) return part as { text: string };
      try {
        return { spec: normalizeSpec(part.spec) as Spec };
      } catch {
        return {
          text: JSON.stringify(part.spec),
          error: "组件格式有误，已显示原文。",
        };
      }
    });
  }, [text]);
  return (
    <div className="learning-content">
      {parts.map((p, i) =>
        p.spec ? (
          <Boundary key={messageId + ":" + i + ":" + specKey(p.spec)}>
            <Artifact
              spec={p.spec}
              session={session}
              id={messageId + ":" + i + ":" + specKey(p.spec)}
              dark={dark}
              ask={ask}
              canAsk={canAsk}
            />
          </Boundary>
        ) : (
          <React.Fragment key={i}>
            {p.error && <p className="muted">{p.error}</p>}
            <article className="text-document">
              <MathText text={p.text ?? ""} />
            </article>
          </React.Fragment>
        ),
      )}
    </div>
  );
}
