import { useMemo, useState } from "react";
import { exportCss, type Project } from "../lib/project";
import {
  exportAse, exportColormap, exportCube, exportITerm, exportJetBrains,
  exportOffice, exportPutty, exportSequence, exportSvg, exportTailwind,
  exportTerminal, exportTokens, exportVim, exportVsCode, exportVsCodeSettings,
} from "../lib/exports";

type ExportContent = string | Uint8Array<ArrayBuffer>;
interface ExportFormat {
  name: string;
  file: string;
  type: string;
  output: (project: Project) => ExportContent;
  guide: string;
  reference?: string;
  encoding?: string;
}

const formats: Record<string, ExportFormat> = {
  css: {
    name: "CSS 변수 · 원본 팔레트 + 역할색", file: "colors-roles.css",
    type: "text/css", output: exportCss,
    guide: "CSS 파일을 불러온 뒤 var(--colors-web-background), var(--colors-web-text)를 사용하세요. 원본색은 --colors-palette-s1처럼 안정 ID로 제공됩니다.",
  },
  vscodeSettings: {
    name: "VS Code 설정 JSON · 기존 설정에 병합", file: "colors-vscode-settings.json",
    type: "application/json", output: exportVsCodeSettings,
    guide: "Preferences: Open User Settings (JSON)에서 두 설정 키를 기존 settings.json에 병합하세요. 편집기 색과 TextMate 구문 색을 적용합니다. 의미 강조와 확장 기능에 따라 일부 색이 달라질 수 있습니다.",
    reference: "https://code.visualstudio.com/docs/configure/themes#_customizing-a-color-theme",
  },
  vscode: {
    name: "VS Code 테마 JSON · 확장 개발용", file: "colors-vscode.json",
    type: "application/json", output: exportVsCode,
    guide: "테마 확장의 contributes.themes에서 이 파일을 참조하세요. 이 JSON 자체는 설치용 VSIX 패키지가 아닙니다.",
    reference: "https://code.visualstudio.com/api/extension-guides/color-theme",
  },
  jetbrains: {
    name: "JetBrains 색 구성 · .icls", file: "colors.icls",
    type: "application/xml", output: exportJetBrains,
    guide: "Settings → Editor → Color Scheme → 설정 메뉴 → Import Scheme에서 파일을 선택하고 Colors를 적용하세요. 편집기 색 구성으로, IDE 전체 UI 테마와는 구분됩니다.",
    reference: "https://www.jetbrains.com/help/idea/configuring-colors-and-fonts.html",
  },
  vim: {
    name: "Vim / Neovim 색 구성 · .vim", file: "colors.vim",
    type: "text/plain", output: exportVim,
    guide: "Vim의 ~/.vim/colors 또는 Neovim의 ~/.config/nvim/colors에 저장한 뒤 :colorscheme colors를 실행하세요. Windows Vim은 ~/vimfiles/colors를 사용합니다. GUI·true color는 HEX를 사용하며 xterm-256은 근사색입니다.",
    reference: "https://vimhelp.org/syntax.txt.html#%3Acolorscheme",
  },
  terminal: {
    name: "Windows Terminal 색 구성 JSON", file: "colors-terminal.json",
    type: "application/json", output: exportTerminal,
    guide: "Windows Terminal의 settings.json에서 schemes 배열에 이 객체를 추가한 뒤 프로필의 colorScheme에 내려받은 name 값을 지정하세요.",
    reference: "https://learn.microsoft.com/en-us/windows/terminal/customize-settings/color-schemes",
  },
  iterm: {
    name: "iTerm2 색 프리셋 · .itermcolors", file: "colors.itermcolors",
    type: "application/xml", output: exportITerm,
    guide: "iTerm2 → Settings → Profiles → Colors → Color Presets → Import에서 파일을 불러온 뒤 colors를 선택하세요. ANSI 16색과 배경·글자·커서·선택 색을 포함합니다.",
    reference: "https://iterm2.com/documentation-preferences-profiles-colors.html",
  },
  putty: {
    name: "PuTTY Colors 세션 색 · .reg", file: "colors-putty.reg",
    type: "application/octet-stream", output: exportPutty, encoding: "utf-16le",
    guide: "Windows에서 파일 내용을 확인한 뒤 가져오면 PuTTY의 Colors 세션에 22개 색 설정을 기록합니다. Session에서 Colors를 Load하고 접속 정보를 입력하세요. 같은 이름의 세션은 해당 색 설정이 갱신됩니다.",
    reference: "https://the.earth.li/~sgtatham/putty/latest/htmldoc/Chapter4.html#config-colours",
  },
  office: {
    name: "Office 색 구성 XML · 12색", file: "colors.clrScheme.xml",
    type: "application/xml", output: exportOffice,
    guide: "Office 테마의 색 구성으로 통합할 수 있는 DrawingML clrScheme입니다. 글꼴·효과까지 포함한 전체 .thmx 테마 파일은 아닙니다.",
    reference: "https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.colorscheme",
  },
  ase: {
    name: "Adobe ASE 색표", file: "colors.ase",
    type: "application/octet-stream", output: exportAse,
    guide: "Adobe 앱의 Swatches/색상 견본 가져오기에서 ASE를 선택하세요. 원본 팔레트의 sRGB 색표이며 ICC 인쇄 색 변환은 포함하지 않습니다.",
  },
  svg: {
    name: "SVG 색표", file: "colors.svg", type: "image/svg+xml", output: exportSvg,
    guide: "브라우저나 벡터 편집기에서 열 수 있는 색표입니다. 현재 원본 팔레트의 색과 HEX를 포함합니다.",
  },
  tokens: {
    name: "DTCG 2025.10 토큰 JSON", file: "colors.tokens.json",
    type: "application/json", output: exportTokens,
    guide: "DTCG 2025.10을 지원하는 토큰 도구에 가져오세요. 원본 팔레트와 각 사용처의 역할색을 포함합니다.",
    reference: "https://www.designtokens.org/tr/2025.10/format/",
  },
  tailwind4: {
    name: "Tailwind 4 @theme", file: "colors.tailwind.css",
    type: "text/css", output: p => exportTailwind(p, 4),
    guide: "Tailwind 4를 불러오는 CSS에서 이 파일을 import하세요. bg-colors-primary, text-colors-text 같은 유틸리티를 사용할 수 있습니다.",
    reference: "https://tailwindcss.com/docs/theme",
  },
  tailwind3: {
    name: "Tailwind 3 config", file: "colors.tailwind.cjs",
    type: "text/javascript", output: p => exportTailwind(p, 3),
    guide: "생성된 theme.extend.colors.colors를 기존 Tailwind 3 설정에 병합하세요.",
    reference: "https://v3.tailwindcss.com/docs/customizing-colors",
  },
  colormap: {
    name: "colormap CSV · 256 표본 + 앵커", file: "colors-colormap.csv",
    type: "text/csv", output: exportColormap,
    guide: "t, hex, anchorId 열을 제공합니다. 모든 앵커 위치를 표본에 포함합니다. 위치 충돌이나 검사한 명도 조건에 문제가 있으면 출력을 차단합니다.",
  },
  cube: {
    name: "창작용 sRGB 33³ LUT .cube", file: "colors-look.cube",
    type: "text/plain", output: exportCube,
    guide: "입출력이 encoded sRGB D65인 창작용 전체 RGB 룩 변환입니다. 영상 도구에서 입력 색공간을 맞춰 사용하세요. 카메라 LOG용 변환이나 팔레트 고정색 보존을 뜻하지 않습니다.",
  },
  sequence: {
    name: "시간적 배색 CSS", file: "colors-sequence.css",
    type: "text/css", output: exportSequence,
    guide: "저장한 장면을 .colors-scene-1 같은 별도 선택자로 출력합니다. 먼저 현재 색을 하나 이상의 장면으로 저장하세요.",
  },
};

function textContent(content: ExportContent, encoding?: string): string | null {
  return typeof content === "string" ? content
    : encoding ? new TextDecoder(encoding).decode(content) : null;
}

export function ExtendedExports({ project, onError }: {
  project: Project | null; onError: (message: string) => void;
}) {
  const [format, setFormat] = useState("css");
  const [showPreview, setShowPreview] = useState(false);
  const selected = formats[format];
  const unavailable = !project || (format === "sequence" && !project.sequence.length);
  const preview = useMemo(() => {
    if (!showPreview || !project || unavailable) return { text: "", error: "" };
    try {
      const content = selected.output(project);
      const text = textContent(content, selected.encoding);
      if (text === null && content instanceof Uint8Array) {
        return { text: `${content.length} bytes\n` + [...content.slice(0, 96)]
          .map(v => v.toString(16).padStart(2, "0")).join(" "), error: "" };
      }
      const lines = text!.split("\n");
      return { text: lines.slice(0, 100).join("\n") +
        (lines.length > 100 ? "\n… 미리보기는 100줄까지 표시합니다. 다운로드에는 전체 내용이 포함됩니다." : ""), error: "" };
    } catch (error) {
      return { text: "", error: error instanceof Error ? error.message : "출력하지 못했습니다." };
    }
  }, [showPreview, project, selected, unavailable]);
  const download = () => {
    if (!project || unavailable) return;
    try {
      const content = selected.output(project);
      const url = URL.createObjectURL(new Blob([content], { type: selected.type }));
      const link = document.createElement("a");
      link.href = url;
      link.download = selected.file;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      onError(error instanceof Error ? error.message : "출력하지 못했습니다.");
    }
  };
  const copy = async () => {
    if (!project || unavailable) return;
    try {
      const text = textContent(selected.output(project), selected.encoding);
      if (text === null) return;
      await navigator.clipboard.writeText(text);
      onError(`${selected.file}의 내용을 복사했습니다.`);
    } catch {
      onError("복사하지 못했습니다. 파일 받기를 이용하세요.");
    }
  };
  return <div className="extended-exports">
    <h3>CSS 변수 · 프로그램별 색 파일</h3>
    <p>현재 채택한 팔레트와 역할색으로 파일을 만듭니다. 역할에서 직접 바꾼 색도 반영됩니다.</p>
    <label className="studio-field">내보내기 형식
      <select aria-label="내보내기 형식" value={format} onChange={e => setFormat(e.target.value)}>
        {Object.entries(formats).map(([key, value]) =>
          <option key={key} value={key}>{value.name}</option>)}
      </select>
    </label>
    <p className="export-filename">받을 파일 <code>{selected.file}</code></p>
    <div className="export-actions">
      <button className="primary-action" type="button" disabled={unavailable}
        onClick={download}>선택한 형식 받기 ↓</button>
      {format !== "ase" && <button type="button" disabled={unavailable}
        onClick={copy}>파일 내용 복사</button>}
    </div>
    {!project && <p className="field-help">팔레트를 만들거나 프로젝트 JSON을 가져오면 파일을 받을 수 있습니다.</p>}
    <div className="export-guide" aria-live="polite">
      <h4>적용 방법</h4><p>{selected.guide}</p>
      {selected.reference && <a href={selected.reference} target="_blank" rel="noreferrer">공식 사용 안내 ↗</a>}
    </div>
    <details className="export-preview" onToggle={e => setShowPreview(e.currentTarget.open)}>
      <summary>파일 내용 미리보기</summary>
      {preview.error ? <p role="alert" className="constraint-warning">{preview.error}</p>
        : <pre tabIndex={0} aria-label="생성 파일 미리보기"><code>{preview.text || "아직 생성할 내용이 없습니다."}</code></pre>}
    </details>
    <p className="field-help">파일은 서버 저장소 없이 브라우저에서 생성합니다. 파일 구조·색값 검사와 각 프로그램의 실제 가져오기 검증은 구분합니다.</p>
  </div>;
}
