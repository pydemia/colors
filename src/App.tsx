import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { UsagePreview } from "./components/UsagePreview";
import {
  conceptSeed,
  contrastRatio,
  generateCandidates,
  normalizeHex,
  suggestTextColor,
  type ConceptInput,
  type Harmony,
  type Mood,
} from "./lib/color";
import {
  chooseCandidate,
  createProject,
  deleteProject,
  exportCss,
  exportProject,
  getRoleHex,
  loadProjects,
  moveSwatch,
  parseProject,
  regenerate,
  resetRole,
  roleKeys,
  saveProject,
  setRoleOverride,
  setRoleSwatch,
  setSwatchHex,
  setSwatchLock,
  type Project,
  type RoleSetName,
  type Source,
  type Swatch,
} from "./lib/project";
import "./styles.css";

type StartMode = "concept" | "baseColor" | "photo";

const useCaseOptions = [
  ["web", "웹사이트"],
  ["publication", "발행물"],
  ["powerPoint", "PowerPoint"],
  ["editor", "코드 편집기"],
  ["terminal", "터미널"],
] as const;

const moodOptions: { id: Mood; name: string }[] = [
  { id: "calm", name: "차분한" },
  { id: "playful", name: "경쾌한" },
  { id: "elegant", name: "우아한" },
  { id: "fresh", name: "산뜻한" },
  { id: "bold", name: "대담한" },
  { id: "natural", name: "자연스러운" },
];

const harmonyOptions: { id: Harmony; name: string; detail: string }[] = [
  { id: "monochromatic", name: "단색", detail: "하나의 색조" },
  { id: "analogous", name: "유사색", detail: "이웃한 색조" },
  { id: "complementary", name: "보색", detail: "반대의 색조" },
  { id: "splitComplementary", name: "분할 보색", detail: "부드러운 대비" },
  { id: "triadic", name: "삼각 배색", detail: "고른 세 색조" },
  { id: "tetradic", name: "사각 배색", detail: "풍부한 네 색조" },
];

const setNames: Record<RoleSetName, string> = {
  web: "웹사이트",
  publication: "발행물",
  powerPoint: "PowerPoint",
  editor: "코드 편집기",
  terminal: "터미널",
};

const setDescriptions: Record<RoleSetName, string> = {
  web: "텍스트, 배경, 버튼과 상태색이 실제 화면에서 만나는 방식",
  publication: "표지와 본문에 색의 리듬을 배치한 화면용 시안",
  powerPoint: "텍스트·배경 4색과 강조 6색을 배치한 슬라이드 시안",
  editor: "VS Code · JetBrains · Vim에 필요한 구문 역할의 모사 시안",
  terminal: "iTerm2 · Windows Terminal · PuTTY의 ANSI 16색 모사 시안",
};

const roleNames: Record<string, string> = {
  background: "배경",
  text: "본문 텍스트",
  primary: "주색",
  secondary: "보조색",
  accent: "강조색",
  link: "링크",
  success: "성공",
  warning: "주의",
  error: "오류",
  cover: "표지",
  bodyBackground: "본문 배경",
  bodyText: "본문 글자",
  dark1: "어두운 텍스트 1",
  light1: "밝은 배경 1",
  dark2: "어두운 텍스트 2",
  light2: "밝은 배경 2",
  accent1: "강조색 1",
  accent2: "강조색 2",
  accent3: "강조색 3",
  accent4: "강조색 4",
  accent5: "강조색 5",
  accent6: "강조색 6",
  hyperlink: "하이퍼링크",
  followedHyperlink: "방문한 링크",
  foreground: "기본 글자",
  cursor: "커서",
  selection: "선택 영역",
  comment: "주석",
  keyword: "키워드",
  string: "문자열",
  number: "숫자",
  type: "타입",
  function: "함수",
  variable: "변수",
  black: "검정",
  red: "빨강",
  green: "초록",
  yellow: "노랑",
  blue: "파랑",
  magenta: "자홍",
  cyan: "청록",
  white: "흰색",
  brightBlack: "밝은 검정",
  brightRed: "밝은 빨강",
  brightGreen: "밝은 초록",
  brightYellow: "밝은 노랑",
  brightBlue: "밝은 파랑",
  brightMagenta: "밝은 자홍",
  brightCyan: "밝은 청록",
  brightWhite: "밝은 흰색",
};

const contrastPairs: Record<
  RoleSetName,
  { foreground: string; background: string; minimum: number }[]
> = {
  web: [
    { foreground: "text", background: "background", minimum: 4.5 },
    { foreground: "link", background: "background", minimum: 4.5 },
  ],
  publication: [
    { foreground: "bodyText", background: "bodyBackground", minimum: 4.5 },
  ],
  powerPoint: [{ foreground: "dark1", background: "light1", minimum: 4.5 }],
  editor: [
    { foreground: "foreground", background: "background", minimum: 4.5 },
    { foreground: "comment", background: "background", minimum: 4.5 },
  ],
  terminal: [
    { foreground: "foreground", background: "background", minimum: 4.5 },
    { foreground: "red", background: "background", minimum: 4.5 },
  ],
};

const defaultConcept: ConceptInput = {
  useCases: ["web"],
  moods: ["calm"],
  hueDirection: "cool",
  lightness: "balanced",
  saturation: "balanced",
  avoidHexes: [],
  note: "",
};

function downloadText(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function projectTitle(project: Project): string {
  if (project.source.kind === "baseColor")
    return `${project.source.hex}에서 시작한 팔레트`;
  if (project.source.kind === "concept") {
    const firstMood = project.source.moods[0];
    return `${moodOptions.find((mood) => mood.id === firstMood)?.name ?? "나만의"} 콘셉트 팔레트`;
  }
  return "사진에서 시작한 팔레트";
}

function SwatchRow({
  swatch,
  index,
  total,
  onLock,
  onColor,
  onMove,
  onError,
}: {
  swatch: Swatch;
  index: number;
  total: number;
  onLock: () => void;
  onColor: (hex: string) => void;
  onMove: (direction: -1 | 1) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(swatch.hex);
  useEffect(() => setDraft(swatch.hex), [swatch.hex]);
  const commit = () => {
    if (draft === swatch.hex) return;
    if (!normalizeHex(draft)) {
      onError("HEX 색상은 #RRGGBB 형식이어야 합니다.");
      setDraft(swatch.hex);
      return;
    }
    onColor(draft);
  };
  return (
    <div className="swatch-row">
      <div
        className="swatch-large"
        style={{ background: swatch.hex }}
        aria-hidden="true"
      />
      <div className="swatch-meta">
        <div className="swatch-label">
          <strong>{String(index + 1).padStart(2, "0")}</strong>
          <span>
            {swatch.origin === "input"
              ? "입력색"
              : swatch.origin === "picked"
                ? "직접 선택"
                : swatch.origin === "autoExtracted"
                  ? "자동 추출"
                  : "생성색"}
          </span>
        </div>
        <label className="sr-only" htmlFor={`swatch-${swatch.id}`}>
          {index + 1}번째 원본색 HEX
        </label>
        <input
          id={`swatch-${swatch.id}`}
          className="hex-input"
          value={draft}
          disabled={swatch.locked}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
      <input
        className="native-color"
        aria-label={`${index + 1}번째 색 선택기`}
        type="color"
        value={swatch.hex}
        disabled={swatch.locked}
        onChange={(event) => onColor(event.target.value)}
      />
      <button
        type="button"
        className={`icon-button ${swatch.locked ? "is-locked" : ""}`}
        onClick={onLock}
        aria-label={`${index + 1}번째 색 ${swatch.locked ? "잠금 해제" : "잠그기"}`}
        title={swatch.locked ? "잠금 해제" : "잠그기"}
      >
        {swatch.locked ? "◈" : "◇"}
      </button>
      <div className="move-buttons">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`${index + 1}번째 색 위로 이동`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`${index + 1}번째 색 아래로 이동`}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

function RoleRow({
  project,
  setName,
  role,
  onSwatch,
  onOverride,
  onReset,
  onError,
}: {
  project: Project;
  setName: RoleSetName;
  role: string;
  onSwatch: (id: string) => void;
  onOverride: (hex: string) => void;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const binding = project.roleSets[setName][role];
  const effective = getRoleHex(project, setName, role);
  const [draft, setDraft] = useState(effective);
  useEffect(() => setDraft(effective), [effective]);
  const commit = () => {
    if (draft.toUpperCase() === effective) return;
    if (!normalizeHex(draft)) {
      onError("HEX 색상은 #RRGGBB 형식이어야 합니다.");
      setDraft(effective);
      return;
    }
    onOverride(draft);
  };
  return (
    <div className="role-row">
      <div className="role-name">
        <span className="role-dot" style={{ background: effective }} />
        <span>{roleNames[role] ?? role}</span>
      </div>
      <select
        aria-label={`${roleNames[role] ?? role} 원본색`}
        value={binding.swatchId}
        onChange={(event) => onSwatch(event.target.value)}
      >
        {project.swatches.map((swatch) => (
          <option key={swatch.id} value={swatch.id}>
            {swatch.id.toUpperCase()} · {swatch.hex}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`role-${setName}-${role}`}>
        {roleNames[role] ?? role} HEX
      </label>
      <input
        id={`role-${setName}-${role}`}
        className="role-hex"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <input
        type="color"
        className="native-color role-picker"
        value={effective}
        aria-label={`${roleNames[role] ?? role} 색 선택기`}
        onChange={(event) => onOverride(event.target.value)}
      />
      {binding.overrideHex && (
        <button
          type="button"
          className="text-button"
          onClick={onReset}
          aria-label={`${roleNames[role] ?? role} 원본색 사용`}
        >
          원본 사용
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<StartMode>("concept");
  const [baseHex, setBaseHex] = useState("#466C9B");
  const [harmony, setHarmony] = useState<Harmony>("analogous");
  const [concept, setConcept] = useState<ConceptInput>(defaultConcept);
  const [avoidDraft, setAvoidDraft] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [candidates, setCandidates] = useState<string[][]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [activeSet, setActiveSet] = useState<RoleSetName>("web");
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const studioRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSavedProjects(loadProjects());
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "저장된 프로젝트를 읽지 못했습니다.",
      );
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      try {
        saveProject(project);
        setSavedProjects(loadProjects());
      } catch {
        setNotice("기기 저장에 실패했습니다. JSON 백업을 받아 주세요.");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [project]);

  const currentPairs = useMemo(
    () =>
      project
        ? contrastPairs[activeSet].map((pair) => ({
            ...pair,
            foregroundHex: getRoleHex(project, activeSet, pair.foreground),
            backgroundHex: getRoleHex(project, activeSet, pair.background),
          }))
        : [],
    [project, activeSet],
  );

  function apply(
    update: (current: Project) => Project,
    message?: string,
  ): void {
    if (!project) return;
    try {
      setProject(update(project));
      if (message) setNotice(message);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "변경하지 못했습니다.",
      );
    }
  }

  function generate(): void {
    try {
      let source: Source;
      let seed: string;
      let selectedHarmony: Harmony;
      if (mode === "photo") return;
      if (mode === "baseColor") {
        const valid = normalizeHex(baseHex);
        if (!valid) throw new Error("기준색은 #RRGGBB 형식으로 입력해 주세요.");
        source = { kind: "baseColor", hex: valid, harmony, generationIndex: 0 };
        seed = valid;
        selectedHarmony = harmony;
      } else {
        const avoidHexes = avoidDraft.trim() ? [normalizeHex(avoidDraft)] : [];
        if (avoidHexes.includes(null))
          throw new Error("피할 색은 #RRGGBB 형식으로 입력해 주세요.");
        const nextConcept = {
          ...concept,
          avoidHexes: avoidHexes.filter((hex): hex is string => Boolean(hex)),
        };
        source = { kind: "concept", ...nextConcept, generationIndex: 0 };
        seed = conceptSeed(nextConcept);
        selectedHarmony = "analogous";
      }
      const nextCandidates = generateCandidates(seed, selectedHarmony);
      setCandidates(nextCandidates);
      setSelectedCandidate(0);
      setProject(createProject(source, nextCandidates[0]));
      setActiveSet(
        source.kind === "concept" && source.useCases[0] in setNames
          ? (source.useCases[0] as RoleSetName)
          : "web",
      );
      setNotice("팔레트 후보 3개를 만들었습니다.");
      window.setTimeout(
        () =>
          studioRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "팔레트를 만들지 못했습니다.",
      );
    }
  }

  function choose(index: number): void {
    if (!project || !candidates[index]) return;
    setProject(chooseCandidate(project, candidates[index]));
    setSelectedCandidate(index);
    setNotice(
      `${index + 1}번 후보를 적용했습니다. 잠긴 색과 직접 수정한 역할은 유지했습니다.`,
    );
  }

  function regenerateCandidates(): void {
    if (!project) return;
    try {
      const result = regenerate(project);
      setProject(result.project);
      setCandidates(result.candidates);
      setSelectedCandidate(0);
      setNotice("새 후보 3개를 만들었습니다. 잠긴 색은 유지했습니다.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "후보를 만들지 못했습니다.",
      );
    }
  }

  function saveNow(): void {
    if (!project) return;
    try {
      saveProject(project);
      setSavedProjects(loadProjects());
      setNotice(
        "이 기기에 저장했습니다. 다른 기기에서도 쓰려면 JSON 백업을 받으세요.",
      );
    } catch {
      setNotice("기기 저장에 실패했습니다. JSON 백업을 받아 주세요.");
    }
  }

  async function importJson(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("프로젝트 JSON은 2MB 이하여야 합니다.");
      const imported = parseProject(await file.text());
      if (
        project &&
        !window.confirm(
          "현재 편집 중인 프로젝트에서 가져온 프로젝트로 이동할까요? 현재 프로젝트는 이 기기에 저장됩니다.",
        )
      )
        return;
      setProject(imported);
      setCandidates([]);
      setActiveSet("web");
      setNotice(
        "프로젝트를 가져왔습니다. 사진 원본은 JSON에 포함되지 않습니다.",
      );
      window.setTimeout(
        () =>
          studioRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "프로젝트를 가져오지 못했습니다.",
      );
    }
  }

  const firstColors = ["#466C9B", "#EFF3F4", "#172C3F", "#92C4B9", "#E2A46D"];

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Colors 처음으로">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            colors<span className="brand-period">.</span>
          </span>
        </a>
        <nav aria-label="주 메뉴" className="header-nav">
          <a href="#create">팔레트 만들기</a>
          <button
            type="button"
            onClick={() => setShowSaved((value) => !value)}
            aria-expanded={showSaved}
          >
            내 프로젝트{" "}
            <span className="project-count">{savedProjects.length}</span>
          </button>
          <a href="#export" className={!project ? "nav-muted" : ""}>
            내보내기
          </a>
          <span className="nav-coming">
            사진 <small>준비 중</small>
          </span>
        </nav>
        <span className="header-edition">COLOR STUDIO / 01</span>
      </header>

      {showSaved && (
        <section className="saved-panel" aria-label="기기에 저장된 프로젝트">
          <div className="saved-panel-head">
            <strong>내 기기의 프로젝트</strong>
            <button
              type="button"
              onClick={() => setShowSaved(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          {savedProjects.length === 0 ? (
            <p>
              아직 저장된 프로젝트가 없습니다. 팔레트를 만들면 이 기기에 자동
              저장됩니다.
            </p>
          ) : (
            <div className="saved-list">
              {savedProjects.map((saved) => (
                <div className="saved-item" key={saved.projectId}>
                  <button
                    type="button"
                    onClick={() => {
                      setProject(saved);
                      setCandidates([]);
                      setShowSaved(false);
                      setNotice("저장된 프로젝트를 열었습니다.");
                      window.setTimeout(
                        () =>
                          studioRef.current?.scrollIntoView({
                            behavior: "smooth",
                          }),
                        50,
                      );
                    }}
                  >
                    <span className="saved-mini-swatches">
                      {saved.swatches.map((swatch) => (
                        <i key={swatch.id} style={{ background: swatch.hex }} />
                      ))}
                    </span>
                    <span>
                      {projectTitle(saved)}
                      <small>
                        {new Date(saved.updatedAt).toLocaleDateString("ko-KR")}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-delete"
                    onClick={() => {
                      if (
                        window.confirm("이 기기에서 이 프로젝트를 삭제할까요?")
                      ) {
                        try {
                          deleteProject(saved.projectId);
                          setSavedProjects(loadProjects());
                          if (project?.projectId === saved.projectId)
                            setProject(null);
                          setNotice("프로젝트를 삭제했습니다.");
                        } catch {
                          setNotice("프로젝트를 삭제하지 못했습니다.");
                        }
                      }
                    }}
                    aria-label={`${projectTitle(saved)} 삭제`}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <main id="top">
        <section className="hero" id="create">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> THE COLOR THINKING TOOL
            </div>
            <h1>
              색을 고르는 순간,
              <br />
              <em>쓰임</em>까지 생각합니다<span className="hero-stop">.</span>
            </h1>
            <p>
              콘셉트와 한 가지 색에서 출발해, 실제 화면에 어울리는 팔레트로
              완성하세요. 색마다 역할을 정하고 바로 비교할 수 있습니다.
            </p>
            <div className="hero-note">
              <span>01</span>
              <span>CREATE</span>
              <i />
              <span>02</span>
              <span>REFINE</span>
              <i />
              <span>03</span>
              <span>APPLY</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-title">
              A study in
              <br />
              five colors.
            </div>
            <div className="hero-art-cards">
              {firstColors.map((color, index) => (
                <div key={color} style={{ background: color }}>
                  <span>0{index + 1}</span>
                  <b>{color}</b>
                </div>
              ))}
            </div>
            <span className="hero-art-caption">COLORS / PALETTE STUDY 001</span>
          </div>
        </section>

        <section
          className="create-section section-frame"
          aria-labelledby="create-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-index">01 / CREATE</span>
              <h2 id="create-title">어디에서 시작할까요?</h2>
              <p>
                출발점만 고르면 나머지는 같은 스튜디오에서 다듬을 수 있습니다.
              </p>
            </div>
            <span className="section-scribble">✳</span>
          </div>
          <div className="start-tabs" aria-label="팔레트 시작 방법">
            <button
              type="button"
              aria-pressed={mode === "concept"}
              className={mode === "concept" ? "active" : ""}
              onClick={() => setMode("concept")}
            >
              <span>01</span> 콘셉트 <b>↗</b>
            </button>
            <button
              type="button"
              aria-pressed={mode === "baseColor"}
              className={mode === "baseColor" ? "active" : ""}
              onClick={() => setMode("baseColor")}
            >
              <span>02</span> 기준색 <b>↗</b>
            </button>
            <button
              type="button"
              aria-pressed={mode === "photo"}
              className={mode === "photo" ? "active" : ""}
              onClick={() => setMode("photo")}
            >
              <span>03</span> 사진 <small>준비 중</small>
            </button>
          </div>

          {mode === "concept" && (
            <div className="input-panel">
              <div className="field-block">
                <span className="field-kicker">01 — WHERE</span>
                <h3>어디에 쓸 색인가요?</h3>
                <div className="choice-wrap">
                  {useCaseOptions.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`choice-pill ${concept.useCases.includes(id) ? "chosen" : ""}`}
                      aria-pressed={concept.useCases.includes(id)}
                      onClick={() =>
                        setConcept((current) => ({
                          ...current,
                          useCases: current.useCases.includes(id)
                            ? current.useCases.filter((item) => item !== id)
                            : [...current.useCases, id],
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-block">
                <span className="field-kicker">02 — FEELING</span>
                <h3>어떤 분위기를 찾나요?</h3>
                <p className="field-help">
                  최대 세 개까지 선택할 수 있습니다. 첫 번째 태그가 색의 방향을
                  이끕니다.
                </p>
                <div className="choice-wrap">
                  {moodOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`choice-pill ${concept.moods.includes(option.id) ? "chosen" : ""}`}
                      aria-pressed={concept.moods.includes(option.id)}
                      onClick={() =>
                        setConcept((current) => ({
                          ...current,
                          moods: current.moods.includes(option.id)
                            ? current.moods.filter((item) => item !== option.id)
                            : current.moods.length < 3
                              ? [...current.moods, option.id]
                              : current.moods,
                        }))
                      }
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-grid">
                <label>
                  색 방향
                  <select
                    value={concept.hueDirection}
                    onChange={(event) =>
                      setConcept({
                        ...concept,
                        hueDirection: event.target
                          .value as ConceptInput["hueDirection"],
                      })
                    }
                  >
                    <option value="warm">따뜻함</option>
                    <option value="cool">차가움</option>
                    <option value="neutral">중립</option>
                    <option value="any">상관없음</option>
                  </select>
                </label>
                <label>
                  밝기
                  <select
                    value={concept.lightness}
                    onChange={(event) =>
                      setConcept({
                        ...concept,
                        lightness: event.target
                          .value as ConceptInput["lightness"],
                      })
                    }
                  >
                    <option value="light">밝음</option>
                    <option value="balanced">중간</option>
                    <option value="dark">어두움</option>
                  </select>
                </label>
                <label>
                  채도
                  <select
                    value={concept.saturation}
                    onChange={(event) =>
                      setConcept({
                        ...concept,
                        saturation: event.target
                          .value as ConceptInput["saturation"],
                      })
                    }
                  >
                    <option value="muted">차분</option>
                    <option value="balanced">중간</option>
                    <option value="vivid">선명</option>
                  </select>
                </label>
                <label>
                  피할 색 <span className="optional">선택</span>
                  <input
                    value={avoidDraft}
                    onChange={(event) => setAvoidDraft(event.target.value)}
                    placeholder="#RRGGBB"
                    maxLength={7}
                  />
                </label>
              </div>
              <label className="note-label">
                자유 메모{" "}
                <span className="optional">생성에는 반영되지 않음</span>
                <textarea
                  value={concept.note}
                  onChange={(event) =>
                    setConcept({ ...concept, note: event.target.value })
                  }
                  placeholder="예: 조용한 아침 같은 느낌"
                  rows={2}
                />
              </label>
              <button
                type="button"
                className="primary-action"
                onClick={generate}
              >
                콘셉트로 후보 만들기 <span>↗</span>
              </button>
            </div>
          )}

          {mode === "baseColor" && (
            <div className="input-panel base-panel">
              <div
                className="base-color-showcase"
                style={{ background: normalizeHex(baseHex) ?? "#466C9B" }}
              >
                <span>YOUR STARTING POINT</span>
                <strong>{normalizeHex(baseHex) ?? "#------"}</strong>
              </div>
              <div className="base-fields">
                <span className="field-kicker">01 — COLOR</span>
                <h3>한 가지 색으로 시작하세요.</h3>
                <div className="base-input-row">
                  <label htmlFor="base-hex">기준색 HEX</label>
                  <input
                    id="base-hex"
                    value={baseHex}
                    onChange={(event) => setBaseHex(event.target.value)}
                    placeholder="#466C9B"
                    maxLength={7}
                  />
                  <input
                    type="color"
                    aria-label="기준색 선택기"
                    value={normalizeHex(baseHex) ?? "#466C9B"}
                    onChange={(event) =>
                      setBaseHex(event.target.value.toUpperCase())
                    }
                  />
                </div>
                <p className="field-help">
                  입력한 기준색은 팔레트에 정확히 남고 처음에는 잠깁니다.
                </p>
                <span className="field-kicker harmony-kicker">
                  02 — HARMONY
                </span>
                <h3>어떤 조화를 원하나요?</h3>
                <div className="harmony-grid">
                  {harmonyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={harmony === option.id ? "selected" : ""}
                      aria-pressed={harmony === option.id}
                      onClick={() => setHarmony(option.id)}
                    >
                      <strong>{option.name}</strong>
                      <small>{option.detail}</small>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="primary-action"
                  onClick={generate}
                >
                  기준색으로 후보 만들기 <span>↗</span>
                </button>
              </div>
            </div>
          )}

          {mode === "photo" && (
            <div className="photo-panel">
              <div className="photo-graphic" aria-hidden="true">
                <div>
                  PHOTO
                  <br />
                  TO
                  <br />
                  PALETTE<span>✳</span>
                </div>
              </div>
              <div>
                <span className="field-kicker">COMING NEXT</span>
                <h3>
                  사진에서 색을 고르는 일,
                  <br />곧 이곳에서 할 수 있어요.
                </h3>
                <p>
                  사진 업로드·검색·추출·사진 파일 다운로드는 다음 단계에서
                  제공합니다. 지금은 콘셉트나 기준색으로 팔레트를 만들어 보세요.
                </p>
                <div className="disabled-menu">
                  <button type="button" disabled>
                    사진 업로드 · 준비 중
                  </button>
                  <button type="button" disabled>
                    사진 검색 · 준비 중
                  </button>
                  <button type="button" disabled>
                    사진 다운로드 · 준비 중
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {project && (
          <section
            className="studio-section section-frame"
            ref={studioRef}
            aria-labelledby="studio-title"
          >
            <div className="section-heading studio-heading">
              <div>
                <span className="section-index">02 / REFINE</span>
                <h2 id="studio-title">나만의 팔레트 스튜디오</h2>
                <p>
                  {projectTitle(project)} · 원본색과 역할색을 따로 다듬을 수
                  있습니다.
                </p>
              </div>
              <div className="autosave-note">
                <span>●</span> 이 기기에 자동 저장
              </div>
            </div>

            {candidates.length > 0 && (
              <div className="candidates-section">
                <div className="subheading">
                  <h3>세 가지 제안</h3>
                  <button type="button" onClick={regenerateCandidates}>
                    새 후보 만들기 ↗
                  </button>
                </div>
                <div className="candidate-grid">
                  {candidates.map((colors, index) => (
                    <button
                      type="button"
                      key={index}
                      className={`candidate-card ${selectedCandidate === index ? "candidate-selected" : ""}`}
                      onClick={() => choose(index)}
                      aria-pressed={selectedCandidate === index}
                    >
                      <span className="candidate-top">
                        OPTION 0{index + 1}
                        <span>
                          {selectedCandidate === index
                            ? "선택됨 ✓"
                            : "적용하기 ↗"}
                        </span>
                      </span>
                      <span className="candidate-swatches">
                        {colors.map((hex, colorIndex) => (
                          <i
                            key={colorIndex}
                            style={{
                              background: project.swatches.find(
                                (swatch) => swatch.id === `s${colorIndex + 1}`,
                              )?.locked
                                ? project.swatches.find(
                                    (swatch) =>
                                      swatch.id === `s${colorIndex + 1}`,
                                  )!.hex
                                : hex,
                            }}
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="help-caption">
                  후보를 바꿔도 잠긴 색과 직접 수정한 역할은 유지됩니다.
                </p>
              </div>
            )}

            <div className="studio-layout">
              <div className="palette-column">
                <div className="subheading">
                  <h3>원본 팔레트</h3>
                  <span>5 COLORS</span>
                </div>
                <p className="panel-intro">
                  잠긴 색은 후보를 바꾸거나 대비 수정안을 적용해도 변하지
                  않습니다.
                </p>
                <div className="swatch-list">
                  {project.swatches.map((swatch, index) => (
                    <SwatchRow
                      key={swatch.id}
                      swatch={swatch}
                      index={index}
                      total={project.swatches.length}
                      onLock={() =>
                        apply((current) =>
                          setSwatchLock(current, swatch.id, !swatch.locked),
                        )
                      }
                      onColor={(hex) =>
                        apply((current) =>
                          setSwatchHex(current, swatch.id, hex),
                        )
                      }
                      onMove={(direction) =>
                        apply((current) =>
                          moveSwatch(current, swatch.id, direction),
                        )
                      }
                      onError={setNotice}
                    />
                  ))}
                </div>
                <div className="palette-footnote">
                  <span>◇</span> 잠그기 / 해제하기 <span>↑↓</span> 순서 바꾸기
                </div>
              </div>

              <div className="usage-column">
                <div className="subheading">
                  <h3>실제로 쓰이는 모습</h3>
                  <span>LIVE PREVIEW</span>
                </div>
                <p className="panel-intro">
                  같은 원본 팔레트에서 용도마다 역할색을 따로 지정합니다.
                </p>
                <div className="usage-tabs" aria-label="사용처 선택">
                  {(Object.keys(setNames) as RoleSetName[]).map((set) => (
                    <button
                      type="button"
                      key={set}
                      className={activeSet === set ? "active" : ""}
                      aria-pressed={activeSet === set}
                      onClick={() => setActiveSet(set)}
                    >
                      {setNames[set]}
                    </button>
                  ))}
                </div>
                <div className="preview-frame">
                  <div className="preview-frame-top">
                    <span className="preview-live-dot" /> {setNames[activeSet]}{" "}
                    시안 <small>실제 프로그램 화면과 다를 수 있습니다</small>
                  </div>
                  <UsagePreview project={project} active={activeSet} />
                </div>
                <p className="preview-description">
                  {setDescriptions[activeSet]}
                </p>
              </div>
            </div>

            <div className="roles-section">
              <div className="section-heading compact">
                <div>
                  <span className="section-index">03 / APPLY</span>
                  <h2>색마다 역할을 주세요.</h2>
                  <p>
                    원본색을 연결하거나 이 역할에만 다른 HEX를 적용할 수
                    있습니다.
                  </p>
                </div>
              </div>
              <div className="roles-layout">
                <div className="role-editor">
                  <div className="subheading">
                    <h3>{setNames[activeSet]} 역할</h3>
                    <span>{roleKeys[activeSet].length} ROLES</span>
                  </div>
                  <div className="role-list">
                    {roleKeys[activeSet].map((role) => (
                      <RoleRow
                        key={`${activeSet}-${role}`}
                        project={project}
                        setName={activeSet}
                        role={role}
                        onSwatch={(id) =>
                          apply((current) =>
                            setRoleSwatch(current, activeSet, role, id),
                          )
                        }
                        onOverride={(hex) =>
                          apply((current) =>
                            setRoleOverride(current, activeSet, role, hex),
                          )
                        }
                        onReset={() =>
                          apply((current) =>
                            resetRole(current, activeSet, role),
                          )
                        }
                        onError={setNotice}
                      />
                    ))}
                  </div>
                </div>
                <div className="contrast-panel">
                  <div className="subheading">
                    <h3>대비 확인</h3>
                    <span>READABILITY</span>
                  </div>
                  <p>
                    실제 전경·배경 역할의 색을 비교합니다. 수정안은 선택할 때만
                    적용됩니다.
                  </p>
                  {currentPairs.map((pair) => {
                    const ratio = contrastRatio(
                      pair.foregroundHex,
                      pair.backgroundHex,
                    );
                    const passes = ratio >= pair.minimum;
                    const suggested = passes
                      ? null
                      : suggestTextColor(
                          pair.foregroundHex,
                          pair.backgroundHex,
                          pair.minimum,
                        );
                    return (
                      <div
                        className={`contrast-card ${passes ? "passes" : "fails"}`}
                        key={`${activeSet}-${pair.foreground}`}
                      >
                        <div className="contrast-card-head">
                          <span>
                            {roleNames[pair.foreground] ?? pair.foreground} /{" "}
                            {roleNames[pair.background] ?? pair.background}
                          </span>
                          <b>{passes ? "통과" : "미달"}</b>
                        </div>
                        <div
                          className="contrast-sample"
                          style={{
                            background: pair.backgroundHex,
                            color: pair.foregroundHex,
                          }}
                        >
                          읽기 좋은 색인가요? Aa
                        </div>
                        <div className="contrast-card-foot">
                          <strong>{ratio.toFixed(2)}:1</strong>
                          <span>목표 {pair.minimum}:1</span>
                        </div>
                        {suggested && (
                          <div className="contrast-suggestion">
                            <span>
                              제안 <i style={{ background: suggested }} />{" "}
                              {suggested} ·{" "}
                              {contrastRatio(
                                suggested,
                                pair.backgroundHex,
                              ).toFixed(2)}
                              :1
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                apply(
                                  (current) =>
                                    setRoleOverride(
                                      current,
                                      activeSet,
                                      pair.foreground,
                                      suggested,
                                      "contrastAccepted",
                                    ),
                                  "대비 수정안을 이 역할에만 적용했습니다.",
                                )
                              }
                            >
                              이 역할에 적용
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <small className="contrast-disclaimer">
                    편집기·터미널 수치는 가독성 목표이며 프로그램의 접근성
                    인증을 뜻하지 않습니다.
                  </small>
                </div>
              </div>
            </div>
          </section>
        )}

        <section
          className="export-section section-frame"
          id="export"
          aria-labelledby="export-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-index">04 / KEEP</span>
              <h2 id="export-title">좋은 색은, 이어서 쓸 수 있게.</h2>
              <p>
                프로젝트는 이 브라우저에 저장됩니다. JSON 백업을 받아 다른
                기기로 옮길 수 있습니다.
              </p>
            </div>
            <span className="export-glyph">↗</span>
          </div>
          <div className="export-grid">
            <div className="export-card available">
              <span className="export-card-number">01 / PROJECT</span>
              <h3>프로젝트 보관</h3>
              <p>잠금·출처·역할색까지 함께 보관합니다.</p>
              <div className="export-actions">
                <button type="button" disabled={!project} onClick={saveNow}>
                  이 기기에 저장
                </button>
                <button
                  type="button"
                  disabled={!project}
                  onClick={() =>
                    project &&
                    downloadText(
                      "colors-project.json",
                      exportProject(project),
                      "application/json",
                    )
                  }
                >
                  JSON 백업 ↓
                </button>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                >
                  JSON 가져오기 ↑
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={importJson}
                  aria-label="프로젝트 JSON 파일"
                />
              </div>
            </div>
            <div className="export-card available">
              <span className="export-card-number">02 / WEB</span>
              <h3>CSS 변수</h3>
              <p>현재 역할색을 CSS 사용자 정의 속성으로 받습니다.</p>
              <div className="export-actions">
                <button
                  type="button"
                  disabled={!project}
                  onClick={() =>
                    project &&
                    downloadText(
                      "colors-roles.css",
                      exportCss(project),
                      "text/css",
                    )
                  }
                >
                  CSS 받기 ↓
                </button>
              </div>
            </div>
            <div className="export-card planned">
              <span className="export-card-number">03 / COMING NEXT</span>
              <h3>프로그램별 파일</h3>
              <p>
                PowerPoint · VS Code · JetBrains · Vim · iTerm2 · Windows
                Terminal · PuTTY
              </p>
              <span className="planned-badge">실제 가져오기 검증 후 제공</span>
            </div>
            <div className="export-card planned">
              <span className="export-card-number">04 / PHOTO</span>
              <h3>사진 기능</h3>
              <p>
                사진 업로드·검색·추출·사진 파일 다운로드와 파일 저장소는 다음
                단계에 준비합니다.
              </p>
              <span className="planned-badge">준비 중</span>
            </div>
          </div>
          <p className="storage-note">
            이 기기의 브라우저 데이터를 지우면 프로젝트도 사라질 수 있습니다.
            중요한 팔레트는 JSON으로 백업해 주세요.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">colors.</span>
        <span>Color, with a purpose.</span>
        <span>© 2026 Colors</span>
      </footer>
      <div className="live-notice" role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}
