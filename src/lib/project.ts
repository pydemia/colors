import {
  type ConceptInput,
  type Harmony,
  generateCandidates,
  normalizeHex,
  oklchHex,
  tone,
  suggestTextColor,
  colorParts,
} from "./color";
import {
  createAnchor, defaultStudio, recommend, validateStudio, withinBounds,
  type Studio,
} from "./studio";

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
export type RoleReason = "generated" | "contrastAccepted" | "userEdit" | "userBinding" | null;

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
    "surface", "textMuted", "onPrimary", "onSuccess", "onWarning",
    "onError", "focusRing",
  ],
  publication: ["cover", "onCover", "bodyBackground", "bodyText", "accent"],
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
  schemaVersion: 2;
  projectId: string;
  source: Source;
  generatorVersion: string;
  swatches: Swatch[];
  roleSets: RoleSets;
  updatedAt: string;
  studio: Studio;
  sequence: { id: string; name: string; swatches: Swatch[];
    roleSets: RoleSets; studio: Studio }[];
}

export const GENERATOR_VERSION = "intent-2.0.0";
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

function legacyRoleSets(hexes: string[]): RoleSets {
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
      surface: ref("s2"), textMuted: ref("s3"), onPrimary: ref("s2"),
      onSuccess: ref("s2"), onWarning: ref("s3"), onError: ref("s2"),
      focusRing: ref("s1"),
    },
    publication: {
      cover: ref("s1"),
      onCover: ref("s2"),
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

export const roleContrastPairs: Record<RoleSetName,
  { foreground: string; background: string; minimum: number; kind: string }[]> = {
  web: [
    ...["text", "textMuted", "link"].map(foreground =>
      ({ foreground, background: "background", minimum: 4.5, kind: "일반 텍스트" })),
    { foreground: "text", background: "surface", minimum: 4.5, kind: "일반 텍스트" },
    ...["primary", "success", "warning", "error"].map(role =>
      ({ foreground: `on${role[0].toUpperCase()}${role.slice(1)}`,
        background: role, minimum: 4.5, kind: "일반 텍스트" })),
    { foreground: "focusRing", background: "background", minimum: 3, kind: "비텍스트" },
    { foreground: "primary", background: "background", minimum: 3, kind: "비텍스트" },
  ],
  publication: [
    { foreground: "bodyText", background: "bodyBackground", minimum: 4.5, kind: "일반 텍스트" },
    { foreground: "onCover", background: "cover", minimum: 4.5, kind: "일반 텍스트" },
    { foreground: "accent", background: "bodyBackground", minimum: 4.5, kind: "일반 텍스트" },
  ],
  powerPoint: [
    { foreground: "dark1", background: "light1", minimum: 4.5, kind: "일반 텍스트" },
    { foreground: "accent1", background: "light1", minimum: 3, kind: "큰 텍스트/그래픽" },
    ...[2, 3, 4, 5, 6].map(i => ({ foreground: `accent${i}`,
      background: "light1", minimum: 3, kind: "그래픽" })),
  ],
  editor: ["foreground", "comment", "keyword", "string", "number",
    "type", "function", "variable", "error", "warning"].map(foreground =>
    ({ foreground, background: "background", minimum: 4.5, kind: "일반 텍스트" })),
  terminal: ["foreground"].map(foreground =>
    ({ foreground, background: "background", minimum: 4.5, kind: "일반 텍스트" })),
};

export function makeRoleSets(hexes: string[], studio?: Studio): RoleSets {
  const roles = legacyRoleSets(hexes);
  if (!studio) return roles;
  const indexed = hexes.map((hex, i) => ({ hex, id: `s${i + 1}` }));
  const byL = [...indexed].sort((a, b) => colorPartsForRole(a.hex) - colorPartsForRole(b.hex));
  const background = studio.theme === "dark" ? byL[0] : byL.at(-1)!;
  const ink = studio.theme === "dark" ? byL.at(-1)! : byL[0];
  roles.web.background = ref(background.id);
  roles.web.text = derived(ink.id, suggestTextColor(ink.hex, background.hex));
  roles.web.surface = derived(background.id,
    tone(background.hex, 0, studio.theme === "dark" ? 0.25 : 0.91, 0.018));
  roles.web.textMuted = derived(ink.id,
    suggestTextColor(tone(ink.hex, 0, studio.theme === "dark" ? 0.65 : 0.5, 0.02), background.hex));
  roles.web.primary = derived("s1", suggestTextColor(hexes[0], background.hex, 3));
  roles.web.link = derived("s1", suggestTextColor(hexes[0], background.hex));
  roles.web.focusRing = derived("s1", suggestTextColor(hexes[0], background.hex, 3));
  roles.publication.bodyBackground = ref(background.id);
  roles.publication.bodyText = roles.web.text;
  roles.powerPoint.light1 = ref(background.id);
  roles.powerPoint.dark1 = roles.web.text;
  for (const set of ["editor", "terminal"] as const) {
    roles[set].background = ref(background.id);
    roles[set].foreground = roles.web.text;
  }
  for (let i = 0; i < 6; i++)
    roles.powerPoint[`accent${i + 1}`] = ref(indexed[i % indexed.length].id);
  for (const set of Object.keys(roleContrastPairs) as RoleSetName[])
    for (const pair of roleContrastPairs[set]) {
      const bg = roles[set][pair.background];
      const fg = roles[set][pair.foreground];
      const bgHex = bg.overrideHex ?? hexes[Number(bg.swatchId.slice(1)) - 1];
      const fgHex = fg.overrideHex ?? hexes[Number(fg.swatchId.slice(1)) - 1];
      roles[set][pair.foreground] = derived(fg.swatchId,
        suggestTextColor(fgHex, bgHex, pair.minimum));
    }
  return roles;
}
function colorPartsForRole(hex: string): number {
  return colorParts(hex).l;
}

function refreshRoles(project: Project, swatches: Swatch[]): RoleSets {
  const sorted = [...swatches].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const automatic = makeRoleSets(sorted.map(s => s.hex), project.studio);
  for (const set of Object.keys(roleKeys) as RoleSetName[])
    for (const role of roleKeys[set]) {
      const previous = project.roleSets[set][role];
      if (["userEdit", "contrastAccepted", "userBinding"].includes(previous?.reason ?? ""))
        automatic[set][role] = previous;
    }
  return automatic;
}

export function createProject(source: Source, colors: string[], config?: Studio): Project {
  if (colors.length < 5 || colors.length > 16 || colors.some((hex) => !normalizeHex(hex))) {
    throw new Error("팔레트는 유효한 HEX 색상 5~16개가 필요합니다.");
  }
  const studio = structuredClone(config ?? defaultStudio(source.kind === "baseColor"
    ? [createAnchor(source.hex, 0)] : [],
    source.kind === "concept" ? source : undefined,
    source.kind === "baseColor" ? source.harmony : "analogous"));
  studio.count = colors.length;
  const swatches: Swatch[] = colors.map((hex, index) => ({
    id: `s${index + 1}`,
    hex: normalizeHex(hex)!,
    origin: studio.anchors.some(a => a.id === `s${index + 1}`) ? "input" : "generated",
    locked: studio.anchors.find(a => a.id === `s${index + 1}`)?.locked ?? false,
  }));
  return {
    schemaVersion: 2,
    projectId: crypto.randomUUID(),
    source,
    generatorVersion: GENERATOR_VERSION,
    swatches,
    roleSets: makeRoleSets(colors, config ? studio : undefined),
    updatedAt: now(),
    studio, sequence: [],
  };
}

export function chooseCandidate(project: Project, colors: string[]): Project {
  if (colors.length !== project.swatches.length || colors.some((hex) => !normalizeHex(hex))) {
    throw new Error("후보의 색 개수 또는 HEX가 잘못되었습니다.");
  }
  for (const anchor of project.studio.anchors) {
    const hex = colors[Number(anchor.id.slice(1)) - 1];
    if (!hex || !withinBounds(anchor, hex))
      throw new Error("후보가 고정색 또는 원색 기준 보정 한계를 넘었습니다.");
  }
  const swatches = project.swatches.map((swatch) =>
    swatch.locked
      ? swatch
      : {
          ...swatch,
          hex:
            normalizeHex(colors[Number(swatch.id.slice(1)) - 1]) ?? swatch.hex,
          origin: swatch.origin,
        },
  );
  const roleSets = refreshRoles(project, swatches);
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
  const studio = { ...project.studio, generation: project.studio.generation + 1 };
  const candidates = recommend(studio).map(c => c.colors);
  return {
    project: {
      ...chooseCandidate({ ...project, studio }, candidates[0]),
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
  const target = project.swatches.find(s => s.id === id);
  if (!target) throw new Error("색상을 찾을 수 없습니다.");
  const existing = project.studio.anchors.find(a => a.id === id);
  const anchors = existing ? project.studio.anchors.map(a => a.id === id
    ? { ...a, locked, ...(locked ? { fixedHex: target.hex } : {}) } : a)
    : [...project.studio.anchors, { ...createAnchor(target.hex, Number(id.slice(1)) - 1,
      project.swatches.length), locked }];
  return {
    ...project,
    swatches: project.swatches.map((swatch) =>
      swatch.id === id ? { ...swatch, locked } : swatch,
    ),
    updatedAt: now(),
    studio: { ...project.studio, anchors },
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
  const studio = { ...project.studio, anchors: project.studio.anchors.map(a =>
    a.id === id ? { ...a, originalHex: hex } : a) };
  const next = { ...project, studio };
  return { ...next, swatches, source, roleSets: refreshRoles(next, swatches), updatedAt: now() };
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
  return setBinding(project, set, role, { ...ref(swatchId), reason: "userBinding" });
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
  const sorted = [...project.swatches].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return setBinding(project, set, role, makeRoleSets(sorted.map(s => s.hex), project.studio)[set][role]);
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
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    throw new Error("지원하지 않는 프로젝트 버전입니다.");
  }
  if (
    typeof value.projectId !== "string" ||
    !isRecord(value.source) ||
    typeof value.generatorVersion !== "string" ||
    typeof value.updatedAt !== "string" ||
    !Array.isArray(value.swatches) ||
    value.swatches.length < 5 || value.swatches.length > 16 ||
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
    item.hex = normalizeHex(item.hex)!;
  }
  if (value.swatches.some((_, i) => !ids.has(`s${i + 1}`))) {
    throw new Error("원본 팔레트의 색상 ID가 잘못되었습니다.");
  }
  for (const set of Object.keys(roleKeys) as RoleSetName[]) {
    const roles = value.roleSets[set];
    if (!isRecord(roles)) throw new Error(`${set} 역할 데이터가 없습니다.`);
    for (const role of roleKeys[set]) {
      if (value.schemaVersion === 1 && !roles[role]) {
        roles[role] = legacyRoleSets(value.swatches.map(s => (s as Record<string, string>).hex))[set][role];
      }
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
        ![null, "generated", "contrastAccepted", "userEdit", "userBinding"].includes(
          binding.reason as string | null,
        ) ||
        (binding.overrideHex === null) !==
          (binding.reason === null || binding.reason === "userBinding")
      ) {
        throw new Error(`${set}.${role} 역할 참조가 잘못되었습니다.`);
      }
      if (typeof binding.overrideHex === "string") binding.overrideHex = normalizeHex(binding.overrideHex)!;
    }
  }
  if (value.schemaVersion === 1) {
    value.schemaVersion = 2;
    const old = value as unknown as Project;
    value.studio = defaultStudio(old.swatches.filter(s => s.locked || s.origin === "input")
      .map(s => ({ ...createAnchor(s.hex, Number(s.id.slice(1)) - 1, old.swatches.length),
        locked: s.locked })), old.source.kind === "concept" ? old.source : undefined,
      old.source.kind === "baseColor" ? old.source.harmony : "analogous");
    (value.studio as Studio).count = old.swatches.length;
    value.sequence = [];
    // v1 did not record manual swatch binding provenance: preserve every link.
    for (const set of Object.keys(roleKeys) as RoleSetName[])
      for (const role of roleKeys[set])
        if (old.roleSets[set][role].reason === null)
          old.roleSets[set][role].reason = "userBinding";
  }
  if (isRecord(value.studio) && value.studio.editingSpace === undefined)
    value.studio.editingSpace = "oklch";
  if (!validateStudio(value.studio) ||
    (value.studio as Studio).anchors.some(a => !ids.has(a.id)) ||
    (value.studio as Studio).count !== value.swatches.length)
    throw new Error("스튜디오 설정 또는 앵커가 잘못되었습니다.");
  (value.studio as Studio).anchors = (value.studio as Studio).anchors.map(a => ({ ...a,
    originalHex: normalizeHex(a.originalHex)!,
    ...(a.fixedHex ? { fixedHex: normalizeHex(a.fixedHex)! } : {}) }));
  if ((value.studio as Studio).anchors.some(a => {
    const swatch = (value.swatches as Swatch[]).find(s => s.id === a.id)!;
    return swatch.locked !== a.locked || !withinBounds(a, swatch.hex);
  })) throw new Error("앵커와 결과색의 잠금·보정 한계가 일치하지 않습니다.");
  if ((value.swatches as Swatch[]).some(s => s.locked &&
    !(value.studio as Studio).anchors.some(a => a.id === s.id)))
    throw new Error("고정색의 앵커 데이터가 없습니다.");
  if (!Array.isArray(value.sequence) || value.sequence.length > 5)
    throw new Error("장면 데이터가 잘못되었습니다.");
  if (new Set(value.sequence.map(s => isRecord(s) ? s.id : null)).size !== value.sequence.length)
    throw new Error("장면 ID가 중복되었습니다.");
  for (const scene of value.sequence) {
    if (!isRecord(scene) || typeof scene.id !== "string" || !scene.id || typeof scene.name !== "string" ||
      !Array.isArray(scene.swatches) || !isRecord(scene.roleSets) || !isRecord(scene.studio))
      throw new Error("장면 데이터가 잘못되었습니다.");
    const parsed = parseProject(JSON.stringify({ ...value, swatches: scene.swatches,
      roleSets: scene.roleSets, studio: scene.studio, sequence: [] }));
    scene.swatches = parsed.swatches;
    scene.roleSets = parsed.roleSets;
    scene.studio = parsed.studio;
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
  backupStorage(storage);
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
  const projects = loadProjects(storage).filter((item) => item.projectId !== projectId);
  backupStorage(storage);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(projects),
  );
}

function backupStorage(storage: Storage): void {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw && !storage.getItem("colors.projects.v1.backup"))
    storage.setItem("colors.projects.v1.backup", raw);
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
