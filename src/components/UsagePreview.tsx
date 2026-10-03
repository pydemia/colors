import { useState, type CSSProperties } from "react";
import { getRoleHex, type Project, type RoleSetName } from "../lib/project";

interface Props {
  project: Project;
  active: RoleSetName;
}

export function UsagePreview({ project, active }: Props) {
  const [language, setLanguage] = useState<"typescript" | "python">(
    "typescript",
  );
  const color = (role: string) => getRoleHex(project, active, role);

  if (active === "web") {
    const style = {
      "--preview-bg": color("background"),
      "--preview-text": color("text"),
      "--preview-primary": color("primary"),
      "--preview-secondary": color("secondary"),
      "--preview-accent": color("accent"),
      "--preview-link": color("link"),
      "--preview-on-primary": color("onPrimary"),
      "--preview-muted": color("textMuted"),
      "--preview-surface": color("surface"),
      "--preview-focus": color("focusRing"),
    } as CSSProperties;
    return (
      <div
        className="web-preview"
        style={style}
        aria-label="웹사이트 색상 시안"
      >
        <div className="web-preview-top">
          <b>studio.</b>
          <span>Work&nbsp;&nbsp; About&nbsp;&nbsp; Journal</span>
          <span className="preview-button">Get in touch ↗</span>
        </div>
        <div className="web-preview-body">
          <span className="preview-eyebrow">A PLACE FOR NEW IDEAS</span>
          <h3>
            Make room for
            <br />
            <em>good things.</em>
          </h3>
          <p>
            좋은 아이디어가 시작되는 공간.
            <br />
            색이 메시지를 더 선명하게 만듭니다.
          </p>
          <div className="web-preview-actions">
            <button type="button" className="preview-button focus-demo" aria-label="시안 버튼 · 포커스 색 확인">시작하기 ↗</button>
            <span className="preview-link">더 알아보기 →</span>
          </div>
          <p className="preview-focus-help">Tab으로 버튼의 포커스 색을 확인하세요.</p>
          <div className="preview-states" style={{ background: color("surface") }}>
            {["success", "warning", "error"].map((role, i) =>
              <span key={role} style={{ background: color(role),
                color: color(`on${role[0].toUpperCase()}${role.slice(1)}`) }}>
                {["✓ 저장 완료", "⚠ 확인 필요", "× 다시 시도"][i]}</span>)}
          </div>
        </div>
        <div className="web-preview-bottom">
          <span>Strategy</span>
          <span>Identity</span>
          <span>Digital</span>
          <span>© 2026 Studio</span>
        </div>
      </div>
    );
  }

  if (active === "publication") {
    const style = {
      "--cover": color("cover"),
      "--cover-ink": color("onCover"),
      "--paper": color("bodyBackground"),
      "--ink": color("bodyText"),
      "--mark": color("accent"),
    } as CSSProperties;
    return (
      <div
        className="publication-preview"
        style={style}
        aria-label="화면용 발행물 색상 시안"
      >
        <div className="publication-cover">
          <div className="publication-kicker">
            COLORS QUARTERLY <span>01 / 2026</span>
          </div>
          <div className="publication-orbit" />
          <h3>
            New
            <br />
            perspectives.
          </h3>
          <div className="publication-cover-foot">
            색으로 읽는 새로운 관점 <span>↗</span>
          </div>
        </div>
        <div className="publication-page">
          <span className="publication-page-number">01 — INTRODUCTION</span>
          <h4>
            생각을 담는
            <br />
            가장 좋은 방식
          </h4>
          <div className="publication-rule" />
          <p>
            색의 쓰임을 정하면 작은 선택들이 하나의 목소리가 됩니다. 본문과
            강조색의 균형을 화면에서 살펴보세요.
          </p>
          <span className="publication-pull">
            “A color is a point of view.”
          </span>
          <div className="publication-page-footer">
            COLORS QUARTERLY <span>03</span>
          </div>
        </div>
      </div>
    );
  }

  if (active === "powerPoint") {
    const style = {
      "--slide-dark": color("dark1"),
      "--slide-light": color("light1"),
      "--slide-accent1": color("accent1"),
      "--slide-accent2": color("accent2"),
      "--slide-accent3": color("accent3"),
      "--slide-accent4": color("accent4"),
      "--slide-accent5": color("accent5"),
      "--slide-accent6": color("accent6"),
    } as CSSProperties;
    return (
      <div
        className="slide-preview"
        style={style}
        aria-label="PowerPoint 색상 시안"
      >
        <div className="slide-mini">01</div>
        <div className="slide-main">
          <div className="slide-header">
            <span>2026 BRAND OUTLOOK</span>
            <span>01 / 12</span>
          </div>
          <h3>
            Ideas in
            <br />
            <span>motion.</span>
          </h3>
          <p>브랜드의 다음 장을 여는 여섯 가지 관점</p>
          <div className="slide-chart" aria-label="강조색 여섯 개의 막대 예시">
            {[1, 2, 3, 4, 5, 6].map((number) => (
              <span
                key={number}
                style={{
                  height: `${28 + number * 11}%`,
                  background: `var(--slide-accent${number})`,
                }}
              />
            ))}
          </div>
          <div className="slide-footer">
            COLORS PRESENTATION <span>● ● ●</span>
          </div>
        </div>
      </div>
    );
  }

  if (active === "editor") {
    const style = {
      "--code-bg": color("background"),
      "--code-fg": color("foreground"),
      "--code-comment": color("comment"),
      "--code-keyword": color("keyword"),
      "--code-string": color("string"),
      "--code-number": color("number"),
      "--code-type": color("type"),
      "--code-function": color("function"),
      "--code-variable": color("variable"),
    } as CSSProperties;
    return (
      <div
        className="editor-preview"
        style={style}
        aria-label="코드 편집기 구문 색상 모사 시안"
      >
        <div className="editor-top">
          <span className="editor-dots">● ● ●</span>
          <div className="editor-language">
            <button
              type="button"
              aria-pressed={language === "typescript"}
              onClick={() => setLanguage("typescript")}
            >
              TypeScript
            </button>
            <button
              type="button"
              aria-pressed={language === "python"}
              onClick={() => setLanguage("python")}
            >
              Python
            </button>
          </div>
          <span>⌕</span>
        </div>
        <div className="editor-body">
          <div className="editor-gutter">
            1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9
          </div>
          {language === "typescript" ? (
            <pre>
              <code>
                <span className="code-comment">// A tiny color story</span>
                {"\n"}
                <span className="code-keyword">type</span>{" "}
                <span className="code-type">Palette</span> = {"{"}
                {"\n"}
                {"  "}
                <span className="code-variable">name</span>:{" "}
                <span className="code-type">string</span>;{"\n"}
                {"  "}
                <span className="code-variable">colors</span>:{" "}
                <span className="code-type">string</span>[];{"\n"}
                {"}"};{"\n\n"}
                <span className="code-keyword">const</span>{" "}
                <span className="code-variable">palette</span>:{" "}
                <span className="code-type">Palette</span> = {"{"}
                {"\n"}
                {"  "}name:{" "}
                <span className="code-string">'New perspective'</span>,{"\n"}
                {"  "}colors: [<span className="code-string">'#336699'</span>,{" "}
                <span className="code-number">5</span>],{"\n"}
                {"}"};
              </code>
            </pre>
          ) : (
            <pre>
              <code>
                <span className="code-comment"># A tiny color story</span>
                {"\n"}
                <span className="code-keyword">from</span>{" "}
                <span className="code-type">dataclasses</span>{" "}
                <span className="code-keyword">import</span>{" "}
                <span className="code-type">dataclass</span>
                {"\n\n"}
                <span className="code-keyword">@dataclass</span>
                {"\n"}
                <span className="code-keyword">class</span>{" "}
                <span className="code-type">Palette</span>:{"\n"}
                {"    "}
                <span className="code-variable">name</span>:{" "}
                <span className="code-type">str</span>
                {"\n"}
                {"    "}
                <span className="code-variable">colors</span>:{" "}
                <span className="code-type">list</span>[
                <span className="code-type">str</span>]{"\n\n"}
                <span className="code-variable">palette</span> ={" "}
                <span className="code-function">Palette</span>(
                <span className="code-string">'New perspective'</span>, [
                <span className="code-string">'#336699'</span>])
              </code>
            </pre>
          )}
        </div>
        <div className="editor-status">
          {language === "typescript" ? "TypeScript" : "Python"}{" "}
          <span>UTF-8&nbsp; · &nbsp;Ln 9, Col 3</span>
        </div>
      </div>
    );
  }

  const ansiRoles = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightMagenta",
    "brightCyan",
    "brightWhite",
  ];
  const style = {
    "--terminal-bg": color("background"),
    "--terminal-fg": color("foreground"),
    "--terminal-cursor": color("cursor"),
  } as CSSProperties;
  return (
    <div
      className="terminal-preview"
      style={style}
      aria-label="터미널 ANSI 색상 모사 시안"
    >
      <div className="terminal-top">
        <span>● ● ●</span>
        <b>colors — zsh</b>
        <span>⌕</span>
      </div>
      <div className="terminal-body">
        <p>
          <strong>❯</strong> colors preview
        </p>
        <p>One palette. Every workspace.</p>
        <div className="ansi-grid">
          {ansiRoles.map((role) => (
            <div key={role} title={role} style={{ background: color(role) }} />
          ))}
        </div>
        <p>
          <strong>❯</strong> <span className="terminal-cursor">&nbsp;</span>
        </p>
      </div>
    </div>
  );
}
