import {
  type ConceptInput,
  type Harmony,
  generateCandidates,
  normalizeHex,
  oklchHex,
  tone,
} from "./color";

export type Source =
  | {
      kind: "baseColor";
      hex: string;
      harmony: Harmony;
      generationIndex: number;
    }
  | ({ kind: "concept"; generationIndex: number } & ConceptInput)
  | {
      kind: "photo";
      image: {
        id: string;
        acquisition: "upload" | "search";
        filename?: string | null;
        provider?: string | null;
        photographer?: string | null;
        pageUrl?: string | null;
        rightsNote?: string | null;
      };
    };

export type Origin = "input" | "generated" | "autoExtracted" | "picked";
export type RoleReason = "generated" | "contrastAccepted" | "userEdit" | null;

export interface Swatch {
  id: string;
  hex: string;
  origin: Origin;
  locked: boolean;
  imageSourceId?: string;
  point?: { x: number; y: number };
}

export interface RoleBinding {
  swatchId: string;
  overrideHex: string | null;
  reason: RoleReason;
}

export const roleKeys = {
  web: [
    "background",
    "text",
    "primary",
    "secondary",
    "accent",
    "link",
    "success",
    "warning",
    "error",
  ],
  publication: ["cover", "bodyBackground", "bodyText", "accent"],
  powerPoint: [
    "dark1",
    "light1",
    "dark2",
    "light2",
    "accent1",
    "accent2",
    "accent3",
    "accent4",
    "accent5",
    "accent6",
    "hyperlink",
    "followedHyperlink",
  ],
  editor: [
    "background",
    "foreground",
    "comment",
    "keyword",
    "string",
    "number",
    "type",
    "function",
    "variable",
    "error",
    "warning",
    "selection",
  ],
  terminal: [
    "background",
    "foreground",
    "cursor",
    "selection",
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
  ],
} as const;

export type RoleSetName = keyof typeof roleKeys;
export type RoleSets = Record<RoleSetName, Record<string, RoleBinding>>;

export interface Project {
  schemaVersion: 1;
  projectId: string;
  source: Source;
  generatorVersion: string;
  swatches: Swatch[];
  roleSets: RoleSets;
  updatedAt: string;
}

export const GENERATOR_VERSION = "rules-1.1.0";
export const STORAGE_KEY = "colors.projects.v1";

function now(): string {
  return new Date().toISOString();
}

function ref(swatchId: string): RoleBinding {
  return { swatchId, overrideHex: null, reason: null };
}

function derived(swatchId: string, overrideHex: string): RoleBinding {
  return { swatchId, overrideHex, reason: "generated" };
}

export function makeRoleSets(hexes: string[]): RoleSets {
  const seed = hexes[0];
  const dark = hexes[2];
  const accentA = hexes[3];
  const accentB = hexes[4];
  const green = oklchHex(0.47, 0.12, 150);
  const amber = oklchHex(0.63, 0.15, 75);
  const red = oklchHex(0.53, 0.18, 25);
  const magenta = tone(seed, 100, 0.55, 0.14);
  const cyan = tone(seed, -75, 0.57, 0.12);

  return {
    web: {
      background: ref("s2"),
      text: ref("s3"),
      primary: ref("s1"),
      secondary: ref("s4"),
      accent: ref("s5"),
      link: ref("s1"),
      success: derived("s1", green),
      warning: derived("s5", amber),
      error: derived("s5", red),
    },
    publication: {
      cover: ref("s1"),
      bodyBackground: ref("s2"),
      bodyText: ref("s3"),
      accent: ref("s5"),
    },
    powerPoint: {
      dark1: ref("s3"),
      light1: ref("s2"),
      dark2: ref("s1"),
      light2: ref("s4"),
      accent1: ref("s1"),
      accent2: ref("s5"),
      accent3: derived("s1", green),
      accent4: derived("s1", magenta),
      accent5: derived("s1", cyan),
      accent6: derived("s3", tone(dark, 0, 0.49, 0.06)),
      hyperlink: ref("s1"),
      followedHyperlink: derived("s1", magenta),
    },
    editor: {
      background: ref("s3"),
      foreground: ref("s2"),
      comment: derived("s4", tone(accentA, 0, 0.68, 0.035)),
      keyword: derived("s1", tone(seed, 0, 0.77, 0.13)),
      string: derived("s1", oklchHex(0.8, 0.11, 145)),
      number: derived("s5", tone(accentB, 0, 0.78, 0.11)),
      type: derived("s1", oklchHex(0.79, 0.1, 195)),
      function: ref("s4"),
      variable: ref("s2"),
      error: derived("s5", oklchHex(0.7, 0.15, 25)),
      warning: derived("s5", oklchHex(0.79, 0.12, 75)),
      selection: derived("s1", tone(seed, 0, 0.38, 0.08)),
    },
    terminal: {
      background: ref("s3"),
      foreground: ref("s2"),
      cursor: ref("s2"),
      selection: derived("s1", tone(seed, 0, 0.38, 0.08)),
      black: ref("s3"),
      red: derived("s5", red),
      green: derived("s1", green),
      yellow: derived("s5", amber),
      blue: ref("s1"),
      magenta: derived("s1", magenta),
      cyan: derived("s1", cyan),
      white: ref("s4"),
      brightBlack: derived("s3", tone(dark, 0, 0.51, 0.04)),
      brightRed: derived("s5", oklchHex(0.71, 0.15, 25)),
      brightGreen: derived("s1", oklchHex(0.77, 0.11, 150)),
      brightYellow: derived("s5", oklchHex(0.83, 0.12, 75)),
      brightBlue: derived("s1", tone(seed, 0, 0.75, 0.12)),
      brightMagenta: derived("s1", tone(seed, 100, 0.75, 0.11)),
      brightCyan: derived("s1", oklchHex(0.8, 0.09, 195)),
      brightWhite: ref("s2"),
    },
  };
}

export function createProject(source: Source, colors: string[]): Project {
  if (colors.length !== 5 || colors.some((hex) => !normalizeHex(hex))) {
    throw new Error("팔레트는 유효한 HEX 색상 5개가 필요합니다.");
  }
  const swatches: Swatch[] = colors.map((hex, index) => ({
    id: `s${index + 1}`,
    hex: normalizeHex(hex)!,
    origin: source.kind === "baseColor" && index === 0 ? "input" : "generated",
    locked: source.kind === "baseColor" && index === 0,
  }));
  return {
    schemaVersion: 1,
    projectId: crypto.randomUUID(),
    source,
    generatorVersion: GENERATOR_VERSION,
    swatches,
    roleSets: makeRoleSets(colors),
    updatedAt: now(),
  };
}

export function chooseCandidate(project: Project, colors: string[]): Project {
  if (colors.length !== 5 || colors.some((hex) => !normalizeHex(hex))) {
    throw new Error("후보는 유효한 HEX 색상 5개여야 합니다.");
  }
  const swatches = project.swatches.map((swatch) =>
    swatch.locked
      ? swatch
      : {
          ...swatch,
          hex:
            normalizeHex(colors[Number(swatch.id.slice(1)) - 1]) ?? swatch.hex,
          origin: "generated" as Origin,
        },
  );
  const automatic = makeRoleSets(
    ["s1", "s2", "s3", "s4", "s5"].map(
      (id) => swatches.find((swatch) => swatch.id === id)!.hex,
    ),
  );
  const roleSets = {} as RoleSets;
  for (const set of Object.keys(roleKeys) as RoleSetName[]) {
    roleSets[set] = {};
    for (const role of roleKeys[set]) {
      const previous = project.roleSets[set][role];
      roleSets[set][role] =
        previous?.reason === "userEdit" ||
        previous?.reason === "contrastAccepted"
          ? previous
          : automatic[set][role];
    }
  }
  return { ...project, swatches, roleSets, updatedAt: now() };
}

export function regenerate(project: Project): {
  project: Project;
  candidates: string[][];
} {
  if (project.source.kind === "photo")
    throw new Error("사진 추출은 준비 중입니다.");
  const generationIndex = project.source.generationIndex + 1;
  const source = { ...project.source, generationIndex };
  const seed =
    source.kind === "baseColor"
      ? source.hex
      : project.swatches.find((swatch) => swatch.id === "s1")!.hex;
  const harmony: Harmony =
    source.kind === "baseColor" ? source.harmony : "analogous";
  const candidates = generateCandidates(seed, harmony, generationIndex);
  return {
    project: {
      ...chooseCandidate(project, candidates[0]),
      source,
      generatorVersion: GENERATOR_VERSION,
    },
    candidates,
  };
}

export function setSwatchLock(
  project: Project,
  id: string,
  locked: boolean,
): Project {
  return {
    ...project,
    swatches: project.swatches.map((swatch) =>
      swatch.id === id ? { ...swatch, locked } : swatch,
    ),
    updatedAt: now(),
  };
}

export function setSwatchHex(
  project: Project,
  id: string,
  input: string,
): Project {
  const hex = normalizeHex(input);
  if (!hex) throw new Error("HEX 색상은 #RRGGBB 형식이어야 합니다.");
  const target = project.swatches.find((swatch) => swatch.id === id);
  if (!target) throw new Error("색상을 찾을 수 없습니다.");
  if (target.locked) throw new Error("잠금을 해제한 뒤 색상을 수정하세요.");
  const swatches = project.swatches.map((swatch) =>
    swatch.id === id ? { ...swatch, hex } : swatch,
  );
  const source =
    project.source.kind === "baseColor" && id === "s1"
      ? { ...project.source, hex }
      : project.source;
  return { ...project, swatches, source, updatedAt: now() };
}

export function moveSwatch(
  project: Project,
  id: string,
  direction: -1 | 1,
): Project {
  const index = project.swatches.findIndex((swatch) => swatch.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= project.swatches.length)
    return project;
  const swatches = [...project.swatches];
  [swatches[index], swatches[target]] = [swatches[target], swatches[index]];
  return { ...project, swatches, updatedAt: now() };
}

export function getRoleHex(
  project: Project,
  set: RoleSetName,
  role: string,
): string {
  const binding = project.roleSets[set]?.[role];
  if (!binding) throw new Error("역할을 찾을 수 없습니다.");
  const swatch = project.swatches.find((item) => item.id === binding.swatchId);
  if (!swatch) throw new Error("역할에 연결된 원본색을 찾을 수 없습니다.");
  return binding.overrideHex ?? swatch.hex;
}

export function setRoleSwatch(
  project: Project,
  set: RoleSetName,
  role: string,
  swatchId: string,
): Project {
  if (!project.swatches.some((swatch) => swatch.id === swatchId))
    throw new Error("원본색을 찾을 수 없습니다.");
  return setBinding(project, set, role, ref(swatchId));
}

function setBinding(
  project: Project,
  set: RoleSetName,
  role: string,
  binding: RoleBinding,
): Project {
  if (!roleKeys[set].some((key) => key === role))
    throw new Error("역할을 찾을 수 없습니다.");
  return {
    ...project,
    roleSets: {
      ...project.roleSets,
      [set]: { ...project.roleSets[set], [role]: binding },
    },
    updatedAt: now(),
  };
}

export function setRoleOverride(
  project: Project,
  set: RoleSetName,
  role: string,
  input: string,
  reason: "userEdit" | "contrastAccepted" = "userEdit",
): Project {
  const hex = normalizeHex(input);
  if (!hex) throw new Error("HEX 색상은 #RRGGBB 형식이어야 합니다.");
  const previous = project.roleSets[set]?.[role];
  if (!previous) throw new Error("역할을 찾을 수 없습니다.");
  return setBinding(project, set, role, {
    ...previous,
    overrideHex: hex,
    reason,
  });
}

export function resetRole(
  project: Project,
  set: RoleSetName,
  role: string,
): Project {
  const previous = project.roleSets[set]?.[role];
  if (!previous) throw new Error("역할을 찾을 수 없습니다.");
  return setBinding(project, set, role, ref(previous.swatchId));
}

export function exportProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function cssName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function exportCss(project: Project): string {
  const lines = [":root {"];
  for (const set of Object.keys(roleKeys) as RoleSetName[]) {
    for (const role of roleKeys[set]) {
      lines.push(
        `  --colors-${cssName(set)}-${cssName(role)}: ${getRoleHex(project, set, role)};`,
      );
    }
  }
  lines.push("}", "");
  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProject(json: string): Project {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("JSON 형식이 올바르지 않습니다.");
  }
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("지원하지 않는 프로젝트 버전입니다.");
  }
  if (
    typeof value.projectId !== "string" ||
    !isRecord(value.source) ||
    typeof value.generatorVersion !== "string" ||
    typeof value.updatedAt !== "string" ||
    !Array.isArray(value.swatches) ||
    value.swatches.length !== 5 ||
    !isRecord(value.roleSets)
  ) {
    throw new Error("프로젝트의 필수 데이터가 없습니다.");
  }
  if (!["baseColor", "concept", "photo"].includes(String(value.source.kind))) {
    throw new Error("알 수 없는 색상 출처입니다.");
  }
  if (value.source.kind === "baseColor") {
    if (
      typeof value.source.hex !== "string" ||
      !normalizeHex(value.source.hex) ||
      ![
        "monochromatic",
        "analogous",
        "complementary",
        "splitComplementary",
        "triadic",
        "tetradic",
      ].includes(String(value.source.harmony))
    ) {
      throw new Error("기준색 출처 데이터가 잘못되었습니다.");
    }
  } else if (value.source.kind === "concept") {
    if (
      !Array.isArray(value.source.useCases) ||
      !value.source.useCases.every((item) => typeof item === "string") ||
      !Array.isArray(value.source.moods) ||
      !value.source.moods.every((item) =>
        ["calm", "playful", "elegant", "fresh", "bold", "natural"].includes(
          String(item),
        ),
      ) ||
      !["warm", "cool", "neutral", "any"].includes(
        String(value.source.hueDirection),
      ) ||
      !["light", "balanced", "dark"].includes(String(value.source.lightness)) ||
      !["muted", "balanced", "vivid"].includes(
        String(value.source.saturation),
      ) ||
      !Array.isArray(value.source.avoidHexes) ||
      !value.source.avoidHexes.every(
        (item) => typeof item === "string" && normalizeHex(item),
      ) ||
      typeof value.source.note !== "string"
    ) {
      throw new Error("콘셉트 출처 데이터가 잘못되었습니다.");
    }
  } else {
    const image = value.source.image;
    if (
      !isRecord(image) ||
      typeof image.id !== "string" ||
      !["upload", "search"].includes(String(image.acquisition))
    ) {
      throw new Error("사진 출처 데이터가 잘못되었습니다.");
    }
  }
  if (value.source.kind !== "photo") {
    const index = value.source.generationIndex;
    if (index === undefined) value.source.generationIndex = 0;
    else if (!Number.isSafeInteger(index) || Number(index) < 0) {
      throw new Error("생성 순서 데이터가 잘못되었습니다.");
    }
  }
  const ids = new Set<string>();
  for (const item of value.swatches) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      typeof item.hex !== "string" ||
      !normalizeHex(item.hex) ||
      typeof item.locked !== "boolean" ||
      !["input", "generated", "autoExtracted", "picked"].includes(
        String(item.origin),
      )
    ) {
      throw new Error("원본 팔레트에 잘못된 색상 또는 중복 ID가 있습니다.");
    }
    if (
      item.point !== undefined &&
      (!isRecord(item.point) ||
        typeof item.point.x !== "number" ||
        item.point.x < 0 ||
        item.point.x > 1 ||
        typeof item.point.y !== "number" ||
        item.point.y < 0 ||
        item.point.y > 1)
    ) {
      throw new Error("사진 선택점 좌표가 잘못되었습니다.");
    }
    ids.add(item.id);
  }
  if (["s1", "s2", "s3", "s4", "s5"].some((id) => !ids.has(id))) {
    throw new Error("원본 팔레트의 색상 ID가 잘못되었습니다.");
  }
  for (const set of Object.keys(roleKeys) as RoleSetName[]) {
    const roles = value.roleSets[set];
    if (!isRecord(roles)) throw new Error(`${set} 역할 데이터가 없습니다.`);
    for (const role of roleKeys[set]) {
      const binding = roles[role];
      if (
        !isRecord(binding) ||
        typeof binding.swatchId !== "string" ||
        !ids.has(binding.swatchId) ||
        !(
          binding.overrideHex === null ||
          (typeof binding.overrideHex === "string" &&
            normalizeHex(binding.overrideHex))
        ) ||
        ![null, "generated", "contrastAccepted", "userEdit"].includes(
          binding.reason as string | null,
        ) ||
        (binding.overrideHex === null) !== (binding.reason === null)
      ) {
        throw new Error(`${set}.${role} 역할 참조가 잘못되었습니다.`);
      }
    }
  }
  return value as unknown as Project;
}

export function loadProjects(storage: Storage = localStorage): Project[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    throw new Error("기기에 저장된 프로젝트를 읽을 수 없습니다.");
  }
  if (!Array.isArray(values))
    throw new Error("기기에 저장된 프로젝트를 읽을 수 없습니다.");
  return values.map((value) => parseProject(JSON.stringify(value)));
}

export function saveProject(
  project: Project,
  storage: Storage = localStorage,
): void {
  const projects = loadProjects(storage);
  const next = [
    project,
    ...projects.filter((item) => item.projectId !== project.projectId),
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function deleteProject(
  projectId: string,
  storage: Storage = localStorage,
): void {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      loadProjects(storage).filter((item) => item.projectId !== projectId),
    ),
  );
}

export function starterProject(): Project {
  const source: Source = {
    kind: "baseColor",
    hex: "#466C9B",
    harmony: "analogous",
    generationIndex: 0,
  };
  return createProject(
    source,
    generateCandidates(source.hex, source.harmony)[0],
  );
}
