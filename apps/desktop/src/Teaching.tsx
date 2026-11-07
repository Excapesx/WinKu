import React, { useState, useMemo } from "react";
import { Expand, Minimize, BookOpen, MessageCircle } from "lucide-react";
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
        className={"component-shell " + (expanded ? "desktop-expanded" : "")}
        onKeyDown={(e) => {
          if (e.key === "Escape") setExpanded(false);
        }}
      >
        <header className="component-header">
          <div className="component-heading">
            <BookOpen />
            <h2>{spec.title || "学习讲解"}</h2>
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
              store.ask("请结合我在这个组件中的操作，继续解释这个概念。")
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
  const parts = useMemo(() => {
    const result: { text?: string; spec?: Spec; error?: string }[] = [];
    const pattern =
      /^(`{3,}|~{3,})(dsh-visual|mermaid|math|latex)[^\S\n]*\n([\s\S]*?)^\1[^\S\n]*$/gm;
    let start = 0,
      m;
    while ((m = pattern.exec(text))) {
      if (m.index > start) result.push({ text: text.slice(start, m.index) });
      try {
        result.push({
          spec: normalizeSpec(
            m[2] === "dsh-visual"
              ? JSON.parse(m[3])
              : m[2] === "mermaid"
                ? { type: "diagram", source: m[3] }
                : { type: "math", latex: m[3] },
          ) as Spec,
        });
      } catch {
        result.push({ text: m[0], error: "组件格式有误，已显示原文。" });
      }
      start = pattern.lastIndex;
    }
    if (start < text.length) result.push({ text: text.slice(start) });
    return result;
  }, [text]);
  return (
    <>
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
            <MathText text={p.text ?? ""} />
          </React.Fragment>
        ),
      )}
    </>
  );
}
