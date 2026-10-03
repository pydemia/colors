import { useEffect, useState, type PointerEvent } from "react";
import { clampChroma, formatHex, type Color } from "culori";
import { colorParts, contrastRatio, luminance, oklchHex } from "../lib/color";
import {
  createAnchor, coordinates, coordinateModes, deltaOK, evaluateMap,
  inferIntent, mapStops, mixColors, parseColor, recommend, validateMap,
  wheelHue, wheelColor, paletteWarnings, type Anchor, type CoordinateMode, type Studio,
} from "../lib/studio";
import { recipes, recipeSource } from "../lib/recipes";
import {
  chooseCandidate, getRoleHex, setSwatchHex,
  type Project,
} from "../lib/project";
import {
  exportAse, exportColormap, exportCube, exportOffice, exportSequence,
  exportSvg, exportTailwind, exportTerminal, exportTokens, exportVsCode,
} from "../lib/exports";

type SettingsProps = { value: Studio; onChange: (studio: Studio) => void };
function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][];
  onChange: (value: string) => void;
}) {
  return <label className="studio-field">{label}<select aria-label={label} value={value}
    onChange={e => onChange(e.target.value)}>{options.map(([id, name]) =>
      <option key={id} value={id}>{name}</option>)}</select></label>;
}
function RangeField({ label, value, min, max, step = 0.01, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (n: number) => void;
}) {
  return <label className="studio-field">{label} <output>{value.toFixed(2)}</output>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} /></label>;
}
export function StudioSettings({ value: s, onChange }: SettingsProps) {
  const change = <K extends keyof Studio>(key: K, value: Studio[K]) => onChange({ ...s, [key]: value });
  const pad = (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.buttons) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const warm = Math.max(-1, Math.min(1, (e.clientX - rect.left) / rect.width * 2 - 1));
    const tint = Math.max(-1, Math.min(1, 1 - (e.clientY - rect.top) / rect.height * 2));
    onChange({ ...s, warm, tint });
  };
  return <div className="studio-settings">
    <div className="settings-grid">
      <SelectField label="화면 테마" value={s.theme} options={[["light", "Light · 밝은 바탕"], ["dark", "Dark · 어두운 바탕"]]}
        onChange={v => change("theme", v as Studio["theme"])} />
      <SelectField label="조합 의도" value={s.intent} options={[["inferred", "입력색의 관계에서 추론"], ["calm", "차분한 조화"], ["bold", "강한 대비"], ["natural", "자연스러운 온기"], ["elegant", "절제된 우아함"]]}
        onChange={v => change("intent", v as Studio["intent"])} />
      <SelectField label="용도 가드" value={s.domain} options={[["ui", "웹 · 앱 UI"], ["cinema", "영화적 룩"], ["brand", "브랜드 · 포스터"], ["fashion", "패션 · 소재 시안"]]}
        onChange={v => change("domain", v as Studio["domain"])} />
      <SelectField label="출력 색 개수" value={String(s.count)}
        options={Array.from({ length: 12 }, (_, i) => [String(i + 5), `${i + 5}색`] as [string, string])}
        onChange={v => change("count", Math.max(Number(v), s.anchors.length))} />
    </div>
    <details className="expert-settings"><summary>Colorist Panel · 색상환과 세부 조정</summary>
      <button type="button" className="light-pad" aria-label="Warm/Cool·Tint 조작 패드. 키보드는 아래 슬라이더를 사용하세요."
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pad(e); }} onPointerMove={pad}>
        <span className="pad-label">Cool ← → Warm<br />Magenta ↑ ↓ Green</span>
        <i style={{ left: `${(s.warm + 1) * 50}%`, top: `${(1 - s.tint) * 50}%` }} />
      </button>
      <div className="settings-grid">
        <SelectField label="색상환" value={s.wheel} options={[["oklch", "OKLCH · 지각 색상환"], ["hsl", "HSL · RGB 색상환"], ["hsv", "HSV · RGB 색상환"], ["ryb", "RYB · 미술 색상환 (근사)"]]}
          onChange={v => change("wheel", v as Studio["wheel"])} />
        <SelectField label="배색 구조" value={s.harmony} options={[["monochromatic", "단색"], ["analogous", "유사색"], ["complementary", "보색"], ["splitComplementary", "분할 보색"], ["triadic", "삼각 배색"], ["tetradic", "사각 배색 · 두 보색쌍"]]}
          onChange={v => change("harmony", v as Studio["harmony"])} />
        <RangeField label="차갑게 ↔ 따뜻하게" value={s.warm} min={-1} max={1} onChange={v => change("warm", v)} />
        <RangeField label="초록 기운 ↔ 자홍 기운" value={s.tint} min={-1} max={1} onChange={v => change("tint", v)} />
        <RangeField label="암부 명도 하한 L" value={s.shadow} min={0} max={s.midtone} onChange={v => change("shadow", v)} />
        <RangeField label="중간톤 명도 L" value={s.midtone} min={s.shadow} max={s.highlight} onChange={v => change("midtone", v)} />
        <RangeField label="명부 명도 상한 L" value={s.highlight} min={s.midtone} max={1} onChange={v => change("highlight", v)} />
        <RangeField label="대비 압축 ↔ 확장" value={s.contrast} min={0.3} max={1.8} onChange={v => change("contrast", v)} />
        <RangeField label="주변 색의 채도" value={s.surroundingChroma} min={0} max={1} onChange={v => change("surroundingChroma", v)} />
      </div>
      <div className="inline-checks">{[["asymmetric", "빛·그림자의 창작용 톤 비대칭"], ["tintedShadow", "미색 암부 제안"], ["texture", "시안 질감 효과"]].map(([key, label]) =>
        <label key={key}><input type="checkbox" checked={Boolean(s[key as keyof Studio])}
          onChange={e => change(key as "asymmetric" | "tintedShadow" | "texture", e.target.checked)} />{label}</label>)}</div>
      <p className="field-help">Warm/Cool·Tint는 Oklab a/b의 창작 조작입니다. 고정색은 보존하고 유연색은 원색 기준 한계 안에서 조정합니다. RYB와 소재 시안은 디지털 근사입니다.</p>
    </details>
  </div>;
}

export function SeedFields({ value: s, onChange }: SettingsProps) {
  const edit = (id: string, patch: Partial<Anchor>) => onChange({ ...s,
    anchors: s.anchors.map(a => a.id === id ? { ...a, ...patch } : a) });
  return <fieldset className="seed-fields"><legend>입력색과 색 고정</legend>
    {s.anchors.map((a, i) => <div className="seed-input" key={a.id}>
      <input type="color" aria-label={`${i + 1}번째 입력색 선택기`} value={parseColor(a.originalHex) ?? "#466C9B"}
        onChange={e => edit(a.id, { originalHex: e.target.value.toUpperCase() })} />
      <label>{i + 1}번째 입력색<input value={a.originalHex} placeholder="#336699 / rgb(...)" aria-invalid={!parseColor(a.originalHex)}
        onChange={e => edit(a.id, { originalHex: e.target.value })} /></label>
      <label className="seed-lock"><input type="checkbox" checked={a.locked}
        onChange={e => edit(a.id, { locked: e.target.checked })} />색 고정 {i + 1}</label>
      {i > 0 && <button type="button" aria-label={`${i + 1}번째 입력색 제거`}
        onClick={() => onChange({ ...s, anchors: s.anchors.filter(x => x.id !== a.id)
          .map((x, index) => ({ ...x, id: `s${index + 1}` })) })}>삭제</button>}
      {!a.locked && <details className="anchor-limits"><summary>보정 한계 · ΔEOK {a.maxDelta}</summary>
        <div className="settings-grid">{[["maxDelta", "최대 ΔEOK", 0.3], ["maxL", "최대 ΔL", 1], ["maxC", "최대 ΔC", 0.4], ["maxH", "최대 ΔH (도)", 180]].map(([key, label, max]) =>
          <label key={key} className="studio-field">{a.id} {label}<input type="number" min={0} max={Number(max)} step={key === "maxH" ? 1 : 0.01}
            value={a[key as "maxDelta"]} onChange={e => edit(a.id, { [key]: Number(e.target.value) })} /></label>)}</div>
        <p className="field-help">반복해 추천받아도 최초 입력색을 기준으로 제한합니다. ΔEOK는 0~1 좌표의 OKLab 거리입니다.</p>
      </details>}
    </div>)}
    <button type="button" disabled={s.anchors.length >= 12} onClick={() => onChange({ ...s,
      anchors: [...s.anchors, createAnchor("#E2A46D", s.anchors.length, s.anchors.length + 1)],
      count: Math.max(s.count, s.anchors.length + 1) })}>입력색 추가 +</button>
    <p className="field-help">고정 ON: HEX 그대로 보존. OFF: 선택한 색을 조합 의도의 초안으로 삼아 제한적으로 보정합니다. 같은 색의 입력도 개별 ID로 유지합니다.</p>
  </fieldset>;
}

export function StoryRecipes({ onSelect }: { onSelect: (id: string) => void }) {
  const [all, setAll] = useState(false);
  return <div className="story-recipes"><div className="subheading"><h3>이야기로 시작하기</h3>
    <button type="button" onClick={() => setAll(!all)} aria-expanded={all}>{all ? "추천 6종" : "전체 16종"}</button></div>
    <div className="recipe-grid">{recipes.slice(0, all ? 16 : 6).map(r => <button type="button"
      key={r.id} onClick={() => onSelect(r.id)}><span className="recipe-colors">{r.colors.map(c =>
        <i key={c} style={{ background: c }} />)}</span><strong>{r.name}</strong><small>{r.detail}</small></button>)}</div>
    <p className="field-help"><a href={recipeSource} target="_blank" rel="noreferrer">사용자 제공 Colorist Rule Book</a>의 HEX를 사용한 서사 프리셋입니다. 선택하면 세 입력색으로 새 초안을 만듭니다.</p>
  </div>;
}

export function RefinementPanel({ project, onProject, onCandidates, onError }: {
  project: Project; onProject: (p: Project) => void;
  onCandidates: (colors: string[][], studio?: Studio) => void; onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(project.studio);
  useEffect(() => setDraft(project.studio), [project.studio]);
  const apply = () => {
    try {
      const options = recommend(draft);
      if (draft.count < project.swatches.length) throw new Error("현재 프로젝트의 색은 삭제되지 않습니다. 새 프로젝트에서 더 작은 색 개수를 선택하세요.");
      onCandidates(options.map(c => c.colors), draft);
    } catch (error) { onError(error instanceof Error ? error.message : "추천하지 못했습니다."); }
  };
  const changes = project.studio.anchors.map(a => ({ ...a,
    result: project.swatches.find(s => s.id === a.id)!.hex }));
  const restore = (id?: string) => {
    const swatches = project.swatches.map(s => {
      const a = project.studio.anchors.find(a => a.id === s.id && (!id || a.id === id));
      return a && !a.locked ? { ...s, hex: a.originalHex } : s;
    });
    onProject(chooseCandidate(project, [...swatches].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))).map(s => s.hex)));
    onCandidates([]);
    onError(`${id ? `${id} 색을` : "유연색을"} 원색으로 되돌렸습니다.`);
  };
  return <div className="refinement-panel">
    <h3>의도를 조정하고 비교하세요.</h3>
    <p>{inferIntent(project.studio.anchors.map(a => a.originalHex))}</p>
    <StudioSettings value={draft} onChange={setDraft} />
    <details><summary>입력색별 보정 한계</summary>{draft.anchors.map(a => <fieldset className="anchor-limits" key={a.id}>
      <legend>{a.id} · {a.originalHex} · {a.locked ? "색 고정" : "유연색"}</legend>
      {!a.locked && <div className="settings-grid">{[["maxDelta", "최대 ΔEOK", 0.3], ["maxL", "최대 ΔL", 1], ["maxC", "최대 ΔC", 0.4], ["maxH", "최대 ΔH (도)", 180]].map(([key, label, max]) =>
        <label key={key} className="studio-field">{a.id} {label}<input type="number" min={0} max={Number(max)} step={key === "maxH" ? 1 : 0.01}
          value={a[key as "maxDelta"]} onChange={e => setDraft({ ...draft, anchors: draft.anchors.map(x => x.id === a.id
            ? { ...x, [key]: Number(e.target.value) } : x) })} /></label>)}</div>}
    </fieldset>)}</details>
    <button className="primary-action" type="button" onClick={apply}>설정으로 후보 만들기 ↗</button>
    <p className="field-help">설정 변경은 초안입니다. 후보 카드를 선택할 때 현재 결과에 적용합니다.</p>
    {changes.length > 0 && <><div className="subheading"><h3>원색 → 현재 추천색</h3>
      <button type="button" onClick={() => restore()}>유연색 모두 되돌리기</button></div>
      <div className="change-list">{changes.map(a => <div key={a.id} className="color-change">
        <span className="comparison-chip" style={{ background: a.originalHex }} />
        <code>{a.originalHex}</code><span>→</span>
        <span className="comparison-chip" style={{ background: a.result }} /><code>{a.result}</code>
        <span>{a.locked ? "고정 ✓" : "유연"} · 원색 대비 ΔEOK {deltaOK(a.originalHex, a.result).toFixed(4)}</span>
        <small>{a.locked ? `고정 목표 ${a.fixedHex ?? a.originalHex}를 보존${a.fixedHex && a.fixedHex !== a.originalHex ? " · 추천된 현재 색을 고정" : ""}` : "명도·채도·의도 조작을 원색 기준 한계 안에 적용"}</small>
        {!a.locked && <button type="button" aria-label={`${a.id} 원색으로 되돌리기`} onClick={() => restore(a.id)}>이 색 되돌리기</button>}
      </div>)}</div></>}
  </div>;
}

export function ColorAnalysis({ project, onProject, onError }: {
  project: Project; onProject: (p: Project) => void; onError: (m: string) => void;
}) {
  const [selected, setSelected] = useState("s1");
  const mode = project.studio.editingSpace;
  const [draft, setDraft] = useState("");
  const [view, setView] = useState("color");
  const swatch = project.swatches.find(s => s.id === selected) ?? project.swatches[0];
  useEffect(() => {
    setDraft(coordinates(swatch.hex, mode).split(/\s+/).map(p => p.split("=")[1] === "—" ? "0" : p.split("=")[1]).join(" "));
  }, [swatch.hex, mode]);
  const s = project.studio;
  const stops = mapStops(s, project.swatches);
  const mapWarnings = validateMap(stops, s);
  const recommendationWarnings = paletteWarnings(s, [...project.swatches].sort((a, b) =>
    Number(a.id.slice(1)) - Number(b.id.slice(1))).map(c => c.hex));
  const keys = mode === "rgb" ? ["r", "g", "b"] : mode === "hsv" ? ["h", "s", "v"] :
    mode === "hsl" ? ["h", "s", "l"] : mode.endsWith("lch") ? ["l", "c", "h"] : ["l", "a", "b"];
  const editCoordinate = () => {
    try {
      const values = draft.trim().split(/[\s,]+/).map(Number);
      if (values.length !== 3 || !values.every(Number.isFinite)) throw new Error("좌표는 세 개의 유한 숫자로 입력하세요.");
      const color = { mode, ...Object.fromEntries(keys.map((k, i) => [k, values[i]])) } as Color;
      const hex = formatHex(clampChroma(color, "oklch")).toUpperCase();
      if (!parseColor(hex)) throw new Error("색 좌표가 잘못되었습니다.");
      onProject(setSwatchHex(project, swatch.id, hex));
    } catch (error) { onError(error instanceof Error ? error.message : "좌표를 적용하지 못했습니다."); }
  };
  const update = (patch: Partial<Studio>) => onProject({ ...project, studio: { ...s, ...patch } });
  return <details className="color-analysis"><summary>색상환 · 표색계 · colormap 분석</summary>
    <div className="subheading"><h3>색의 구조를 살펴보세요.</h3>
      <select aria-label="분석 보기" value={view} onChange={e => setView(e.target.value)}>
        <option value="color">원색 보기</option><option value="value">명도만 보기</option></select></div>
    <div className="analysis-grid"><div>
      <svg viewBox="0 0 240 240" className="color-wheel" role="img" aria-label={`${s.wheel.toUpperCase()} 색상환에서 팔레트의 위치`}>
        {Array.from({ length: 72 }, (_, i) => {
          const a = i * Math.PI / 36;
          return <circle key={i} cx={120 + 95 * Math.cos(a)} cy={120 + 95 * Math.sin(a)} r={6}
            fill={wheelColor(i * 5, s.wheel)} />;
        })}
        {project.swatches.map((color, i) => {
          const a = wheelHue(color.hex, s.wheel) * Math.PI / 180;
          return <g key={color.id}><circle cx={120 + 70 * Math.cos(a)} cy={120 + 70 * Math.sin(a)} r={12}
            fill={color.hex} stroke="#222" /><text x={120 + 70 * Math.cos(a)} y={124 + 70 * Math.sin(a)}
            textAnchor="middle" fill={contrastRatio(color.hex, "#FFFFFF") > 4.5 ? "white" : "black"} fontSize="10">{i + 1}</text></g>;
        })}<text x="120" y="120" textAnchor="middle" fontSize="16">{s.wheel.toUpperCase()}</text>
      </svg><p className="field-help">무채색의 hue는 비교하지 않습니다. 표색계 변경은 색값을 바꾸지 않습니다.</p>
    </div><div><div className="value-bars">{project.swatches.map((color, i) => {
      const p = colorParts(color.hex);
      return <div key={color.id}><span>{i + 1}</span><i style={{ width: `${p.l * 100}%`,
        background: view === "value" ? oklchHex(p.l, 0, 0) : color.hex }} /><code>L {p.l.toFixed(3)} · Y {luminance(color.hex).toFixed(3)} · C {p.c.toFixed(3)}</code></div>;
    })}</div><p className="field-help">L: OKLCH 지각 명도 (0~1). Y: WCAG 상대 휘도 (0~1). 영상 IRE와 다른 값입니다.</p>
      <div className="settings-grid"><SelectField label="편집할 색" value={swatch.id}
        options={project.swatches.map((c, i) => [c.id, `${i + 1} · ${c.hex}`])} onChange={setSelected} />
        <SelectField label="표색계" value={mode} options={coordinateModes.map(m => [m, m.toUpperCase() + (["lab", "lch"].includes(m) ? " · D50" : "")])}
          onChange={v => update({ editingSpace: v as CoordinateMode })} /></div>
      <p><code>{coordinates(swatch.hex, mode)}</code></p>
      <label className="studio-field">{keys.join(" / ")} 좌표<input value={draft}
        onChange={e => setDraft(e.target.value)} disabled={swatch.locked} /></label>
      <p className="field-help">RGB·S·L·V는 0~1, hue는 도. Lab/LCH L은 0~100 (D50), OKLab/OKLCH L은 0~1. 색역 초과 시 채도를 줄여 sRGB에 맞춥니다. 직접 편집은 새 입력 기준을 정합니다.</p>
      <button type="button" onClick={editCoordinate} disabled={swatch.locked}>좌표를 색에 적용</button>
    </div></div>
    <div className="settings-grid"><SelectField label="colormap 유형" value={s.mapKind}
      options={[["qualitative", "범주형 · qualitative"], ["sequential", "순차형 · sequential"], ["diverging", "발산형 · diverging"], ["cyclic", "순환형 · cyclic"]]}
      onChange={v => update({ mapKind: v as Studio["mapKind"] })} />
      <SelectField label="혼합 방식" value={s.mixModel} options={[["perceptual", "지각 보간 · OKLab"], ["additive", "가색 · 선형 RGB 광량 합"], ["average", "가색 · 선형 RGB 평균"], ["subtractive", "감색 · 필터 투과율 근사"]]}
        onChange={v => update({ mixModel: v as Studio["mixModel"] })} /></div>
    <p className="field-help">가색 합은 선형 RGB 평균에 1+4t(1−t) 광량을 적용합니다 (중간 2배, 끝점 1배). sRGB 범위 초과는 클리핑합니다. 감색은 선형 투과율 A^(1−t)·B^t이며 실제 물감·CMYK 인쇄와 다릅니다.</p>
    <div className="colormap-ramp" aria-label="현재 colormap 표본">{Array.from({ length: 100 }, (_, i) =>
      <i key={i} style={{ background: evaluateMap(stops, i / 99, s) }} />)}</div>
    <div className="mix-example"><span>처음</span><i style={{ background: mixColors(project.swatches[0].hex, project.swatches.at(-1)!.hex, 0.5, s.mixModel) }} />
      <span>두 끝 색의 중간 혼합</span><span>끝</span></div>
    <div className="stop-list">{s.anchors.map(a => <div key={a.id}><code>{a.id} {project.swatches.find(x => x.id === a.id)!.hex}</code>
      <label>위치 t<input aria-label={`${a.id} 위치 t`} type="number" min={0} max={1} step={0.01} value={a.positionLocked ? a.t : stops.find(x => x.id === a.id)!.t}
        onChange={e => update({ anchors: s.anchors.map(x => x.id === a.id ? { ...x, t: Math.max(0, Math.min(1, Number(e.target.value))), positionLocked: true } : x) })} /></label>
      <label><input aria-label={`${a.id} 위치 고정`} type="checkbox" checked={a.positionLocked} onChange={e => update({ anchors: s.anchors.map(x => x.id === a.id
        ? { ...x, t: stops.find(x => x.id === a.id)!.t, positionLocked: e.target.checked } : x) })} />위치 고정</label></div>)}</div>
    <p className="field-help">순차형은 어두움→밝음, 발산형은 중심 t=0.5에서 명도가 높아지는 구조입니다. 순환형은 f(0)=f(1)로 닫습니다. 충돌이 남으면 CSV를 내보낼 수 없습니다.</p>
    <div aria-live="polite" className="constraint-feedback">{[...new Set([...mapWarnings, ...recommendationWarnings])].map(w =>
      <p key={w} className="constraint-warning">⚠ {w}</p>)}{!mapWarnings.length && <p>✓ 검사한 위치·명도 조건 통과. 순차/발산형은 257 표본에서 L 역전 허용오차 0.006으로 확인합니다.</p>}</div>
  </details>;
}

export function ExtendedExports({ project, onError }: { project: Project | null; onError: (m: string) => void }) {
  const [format, setFormat] = useState("tokens");
  const formats: Record<string, { name: string; file: string; type: string; output: (p: Project) => string | Uint8Array<ArrayBuffer> }> = {
    tokens: { name: "DTCG 2025.10 토큰 JSON", file: "colors.tokens.json", type: "application/json", output: exportTokens },
    tailwind4: { name: "Tailwind 4 @theme", file: "colors.tailwind.css", type: "text/css", output: p => exportTailwind(p, 4) },
    tailwind3: { name: "Tailwind 3 config", file: "colors.tailwind.cjs", type: "text/javascript", output: p => exportTailwind(p, 3) },
    svg: { name: "SVG 색표", file: "colors.svg", type: "image/svg+xml", output: exportSvg },
    ase: { name: "Adobe ASE 색표", file: "colors.ase", type: "application/octet-stream", output: exportAse },
    office: { name: "Office 색 구성 XML", file: "colors.clrScheme.xml", type: "application/xml", output: exportOffice },
    vscode: { name: "VS Code 색 테마 JSON", file: "colors-vscode.json", type: "application/json", output: exportVsCode },
    terminal: { name: "Windows Terminal 색 구성 JSON", file: "colors-terminal.json", type: "application/json", output: exportTerminal },
    colormap: { name: "colormap CSV · 256 표본 + 앵커", file: "colors-colormap.csv", type: "text/csv", output: exportColormap },
    cube: { name: "창작용 sRGB 33³ LUT .cube", file: "colors-look.cube", type: "text/plain", output: exportCube },
    sequence: { name: "시간적 배색 CSS", file: "colors-sequence.css", type: "text/css", output: exportSequence },
  };
  const download = () => {
    if (!project) return;
    try {
      const f = formats[format];
      const output = f.output(project);
      const url = URL.createObjectURL(new Blob([output], { type: f.type }));
      const link = document.createElement("a"); link.href = url; link.download = f.file;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { onError(error instanceof Error ? error.message : "출력하지 못했습니다."); }
  };
  return <div className="extended-exports"><h3>사용할 도구에 맞춰 가져가세요.</h3>
    <SelectField label="내보내기 형식" value={format} options={Object.entries(formats).map(([k, f]) => [k, f.name])} onChange={setFormat} />
    <button className="primary-action" type="button" disabled={!project || (format === "sequence" && !project.sequence.length)}
      onClick={download}>선택한 형식 받기 ↓</button>
    <p className="field-help">Office XML은 12색 clrScheme입니다. JSON은 각 도구의 색 테마/색 구성 파일입니다. ASE·Office·영상 도구의 실제 가져오기는 별도 확인이 필요합니다. LUT는 sRGB 화면용 룩이며 카메라 LOG 변환이 아닙니다. 고정색 포함 보장은 팔레트·colormap 출력에 적용합니다.</p>
  </div>;
}

export function ContextScenes({ project, onProject }: { project: Project; onProject: (p: Project) => void }) {
  const [scene, setScene] = useState("poster");
  const [gray, setGray] = useState(false);
  const s = project.studio;
  const color = (role: string) => {
    const hex = getRoleHex(project, "web", role);
    return gray ? oklchHex(colorParts(hex).l, 0, 0) : hex;
  };
  const total = s.area.reduce((a, b) => a + b, 0);
  const save = () => {
    if (project.sequence.length >= 5) return;
    onProject({ ...project, sequence: [...project.sequence, {
      id: crypto.randomUUID(), name: `장면 ${project.sequence.length + 1}`,
      studio: structuredClone(s), swatches: structuredClone(project.swatches),
      roleSets: structuredClone(project.roleSets),
    }] });
  };
  return <details className="context-scenes"><summary>포스터 · 영화 · 공간 · 시간적 배색</summary><div className="subheading"><h3>색이 놓이는 맥락</h3>
    <label><input type="checkbox" checked={gray} onChange={e => setGray(e.target.checked)} />명도 시안</label></div>
    <div className="usage-tabs">{[["poster", "포스터"], ["cinema", "영화 프레임"], ["room", "공간"], ["fashion", "패션"]].map(([id, label]) =>
      <button key={id} type="button" aria-pressed={scene === id} onClick={() => setScene(id)}>{label}</button>)}</div>
    <div className={`scene-preview scene-${scene} ${s.texture ? "scene-textured" : ""}`}
      style={{ background: color("background"), color: color("text") }} aria-label={`${scene} 배색 시안`}>
      <div className="scene-depth-back" style={{ background: color("surface") }} />
      <div className="scene-depth-mid" style={{ background: color("secondary") }} />
      <div className="scene-depth-front" style={{ background: color("primary") }} />
      <div className="scene-title"><span>01 / COLOR STORY</span><strong>{scene === "cinema" ? "AFTER THE RAIN" :
        scene === "room" ? "ROOM FOR IDEAS" : scene === "fashion" ? "FORM & FABRIC" : "A different perspective."}</strong>
        <small>{scene === "room" ? "디지털 공간 배색 시안" : scene === "fashion" ? "원단색의 화면용 조합" : "전경 · 중경 · 원경의 색 관계"}</small></div>
    </div><p className="field-help">공간·패션은 색 배치 시안입니다. 실제 광원·반사광·원단 측색을 재현하지 않습니다. 질감 효과는 색값과 대비 검사에서 분리됩니다.</p>
    <div className="context-comparison">{["#FFFFFF", "#777777", "#111111"].map(bg => <div key={bg} style={{ background: bg }}>
      <span style={{ background: project.swatches[0].hex }} /></div>)}</div>
    <p className="field-help">동일한 {project.swatches[0].hex}를 서로 다른 주변에 배치했습니다.</p>
    <div className="area-strip" aria-label="주조색·보조색·강조색 면적 비율">{["background", "secondary", "primary"].map((role, i) =>
      <div key={role} style={{ background: color(role), flex: s.area[i] }} />)}</div>
    <div className="settings-grid">{["주조색", "보조색", "강조색"].map((label, i) =>
      <label className="studio-field" key={label}>{label} 면적 {(s.area[i] / total * 100).toFixed(0)}%
        <input type="range" min={1} max={100} value={s.area[i]} onChange={e => {
          const area = [...s.area] as Studio["area"]; area[i] = Number(e.target.value);
          onProject({ ...project, studio: { ...s, area } });
        }} /></label>)}</div>
    <div className="subheading"><h3>시간적 배색 · 최대 5장면</h3><button type="button" onClick={save} disabled={project.sequence.length >= 5}>현재 색을 장면으로 저장 +</button></div>
    <ol className="sequence-list">{project.sequence.map((saved, i) => <li key={saved.id}>
      <label>장면 이름<input aria-label={`장면 ${i + 1} 이름`} value={saved.name} onChange={e => onProject({ ...project,
        sequence: project.sequence.map(x => x.id === saved.id ? { ...x, name: e.target.value } : x) })} /></label>
      <span className="sequence-colors">{saved.swatches.map(c => <i key={c.id} style={{ background: c.hex }} />)}</span>
      <button type="button" onClick={() => onProject({ ...project, studio: structuredClone(saved.studio), swatches: structuredClone(saved.swatches), roleSets: structuredClone(saved.roleSets) })}>장면 {i + 1} 불러오기</button>
      <button type="button" disabled={i === 0} onClick={() => { const next = [...project.sequence];
        [next[i - 1], next[i]] = [next[i], next[i - 1]]; onProject({ ...project, sequence: next }); }}>앞으로 ↑</button>
      <button type="button" aria-label={`장면 ${i + 1} 삭제`} onClick={() => onProject({ ...project, sequence: project.sequence.filter(x => x.id !== saved.id) })}>삭제</button>
    </li>)}</ol>
  </details>;
}
