import {
  clampChroma, converter, formatHex, parse, type Color,
} from "culori";
import {
  colorParts, conceptSeed, normalizeHex, oklchHex,
  type ConceptInput, type Harmony,
} from "./color";

export type Wheel = "oklch" | "hsl" | "hsv" | "ryb";
export type MapKind = "qualitative" | "sequential" | "diverging" | "cyclic";
export type MixModel = "perceptual" | "additive" | "average" | "subtractive";
export interface Anchor {
  id: string;
  originalHex: string;
  fixedHex?: string;
  locked: boolean;
  maxDelta: number;
  maxL: number;
  maxC: number;
  maxH: number;
  t: number;
  positionLocked: boolean;
}
export interface Studio {
  anchors: Anchor[];
  count: number;
  harmony: Harmony;
  wheel: Wheel;
  editingSpace: CoordinateMode;
  theme: "light" | "dark";
  domain: "ui" | "cinema" | "brand" | "fashion";
  intent: "inferred" | "calm" | "bold" | "natural" | "elegant";
  concept: ConceptInput;
  recipeId: string | null;
  warm: number;
  tint: number;
  shadow: number;
  midtone: number;
  highlight: number;
  contrast: number;
  surroundingChroma: number;
  asymmetric: boolean;
  tintedShadow: boolean;
  texture: boolean;
  area: [number, number, number];
  mapKind: MapKind;
  mixModel: MixModel;
  generation: number;
}
export interface ColorStop { id: string; t: number; hex: string }
export interface Recommendation {
  name: string;
  colors: string[];
  warnings: string[];
  changes: { id: string; original: string; hex: string; delta: number; reason: string }[];
}
const rgb = converter("rgb");
const lab = converter("oklab");
const linear = converter("lrgb");
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const hueDistance = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);

export function parseColor(input: string): string | null {
  const value = parse(input.trim());
  if (!value || (value.alpha !== undefined && value.alpha !== 1)) return null;
  const channels = rgb(value);
  if (!channels || ![channels.r, channels.g, channels.b].every(Number.isFinite))
    return null;
  return formatHex(clampChroma(value, "oklch")).toUpperCase();
}
export function deltaOK(a: string, b: string): number {
  const x = lab(a)!;
  const y = lab(b)!;
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}
export function createAnchor(hex: string, index: number, total = 1): Anchor {
  const valid = parseColor(hex);
  if (!valid) throw new Error("유효한 불투명 색을 입력해 주세요.");
  return {
    id: `s${index + 1}`, originalHex: valid, locked: true,
    maxDelta: 0.05, maxL: 0.08, maxC: 0.04, maxH: 15,
    t: total < 2 ? 0 : index / (total - 1), positionLocked: false,
  };
}
export function defaultStudio(
  anchors: Anchor[], concept?: ConceptInput, harmony: Harmony = "analogous",
): Studio {
  return {
    anchors, count: Math.max(6, anchors.length), harmony, wheel: "oklch", editingSpace: "oklch",
    theme: "light", domain: "ui", intent: "inferred",
    concept: concept ?? {
      useCases: ["web"], moods: ["calm"], hueDirection: "any",
      lightness: "balanced", saturation: "balanced", avoidHexes: [], note: "",
    },
    recipeId: null, warm: 0, tint: 0, shadow: 0.18, midtone: 0.55,
    highlight: 0.96, contrast: 1, surroundingChroma: 1,
    asymmetric: true, tintedShadow: true, texture: false,
    area: [60, 30, 10], mapKind: "qualitative", mixModel: "perceptual",
    generation: 0,
  };
}
export function withinBounds(anchor: Anchor, hex: string): boolean {
  if (anchor.locked) return hex === (anchor.fixedHex ?? anchor.originalHex);
  const a = colorParts(anchor.originalHex);
  const b = colorParts(hex);
  return deltaOK(anchor.originalHex, hex) <= anchor.maxDelta + 1e-9 &&
    Math.abs(a.l - b.l) <= anchor.maxL + 1e-9 &&
    Math.abs(a.c - b.c) <= anchor.maxC + 1e-9 &&
    (a.c < 0.01 || b.c < 0.01 || hueDistance(a.h, b.h) <= anchor.maxH + 1e-9);
}
export function mixColors(a: string, b: string, t: number, model: MixModel): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  if (model === "perceptual") {
    const x = lab(a)!;
    const y = lab(b)!;
    return formatHex(clampChroma({ mode: "oklab", l: x.l + (y.l - x.l) * t,
      a: x.a + (y.a - x.a) * t, b: x.b + (y.b - x.b) * t }, "oklch"))
      .toUpperCase();
  }
  const x = linear(a)!;
  const y = linear(b)!;
  const channel = (u: number, v: number) => model === "subtractive"
    ? u ** (1 - t) * v ** t
    : clamp((u * (1 - t) + v * t) * (model === "additive" ? 1 + 4 * t * (1 - t) : 1));
  return formatHex({ mode: "lrgb", r: channel(x.r, y.r),
    g: channel(x.g, y.g), b: channel(x.b, y.b) }).toUpperCase();
}
function bounded(anchor: Anchor, target: string): string {
  if (anchor.locked) return anchor.fixedHex ?? anchor.originalHex;
  // Verify the quantized, gamut-mapped output, not just its requested coordinates.
  for (let step = 100; step >= 0; step--) {
    const result = mixColors(anchor.originalHex, target, step / 100, "perceptual");
    if (withinBounds(anchor, result)) return result;
  }
  return anchor.originalHex;
}

export function inferIntent(hexes: string[]): string {
  if (!hexes.length) return "콘셉트에서 명도와 채도의 관계를 만듭니다.";
  const parts = hexes.map(colorParts);
  const chromatic = parts.filter(p => p.c > 0.01);
  let widest = 0;
  for (const a of chromatic) for (const b of chromatic)
    widest = Math.max(widest, hueDistance(a.h, b.h));
  const gap = Math.max(...parts.map(p => p.l)) - Math.min(...parts.map(p => p.l));
  return `${chromatic.length ? widest > 145 ? "맞서는 색상축" :
    widest < 55 ? "가까운 색상축" : "여러 색상축" : "무채색 중심"} · ` +
    `${gap > 0.3 ? "명도 차이가 큰" : "명도가 가까운"} 조합입니다. ` +
    "입력색의 관계에서 추론한 초안이며 아래 의도 선택으로 바꿀 수 있습니다.";
}
const rotations: Record<Harmony, number[]> = {
  monochromatic: [0], analogous: [0, -30, 30], complementary: [0, 180],
  splitComplementary: [0, 150, 210], triadic: [0, 120, 240],
  tetradic: [0, 60, 180, 240],
};
// Traditional RYB hue positions mapped to display HSL; an artistic approximation.
const rybHsl = [0, 15, 30, 45, 60, 90, 120, 165, 210, 240, 270, 315, 360];
function piecewise(value: number, from: number[], to: number[]): number {
  const h = ((value % 360) + 360) % 360;
  let i = 0;
  while (i < from.length - 2 && h > from[i + 1]) i++;
  return to[i] + (to[i + 1] - to[i]) * (h - from[i]) / (from[i + 1] - from[i]);
}
const uniform = rybHsl.map((_, i) => i * 30);
export function wheelHue(hex: string, wheel: Wheel): number {
  if (colorParts(hex).c < 0.01) return 0;
  if (wheel === "oklch") return colorParts(hex).h;
  const h = converter(wheel === "hsv" ? "hsv" : "hsl")(hex)!.h ?? 0;
  return wheel === "ryb" ? piecewise(h, rybHsl, uniform) : h;
}
function rotate(hex: string, degrees: number, wheel: Wheel, l: number, c: number): string {
  if (wheel === "oklch") return oklchHex(l, c, colorParts(hex).h + degrees);
  const mode = wheel === "hsv" ? "hsv" : "hsl";
  const base = converter(mode)(hex)!;
  const hue = wheel === "ryb"
    ? piecewise(wheelHue(hex, wheel) + degrees, uniform, rybHsl)
    : (base.h ?? 0) + degrees;
  const parts = colorParts(formatHex({ ...base, h: hue }));
  return oklchHex(l, c, parts.h);
}
export function lookColor(input: Color | string, settings: Studio): Color {
  const p = lab(input)!;
  if (settings.warm === 0 && settings.tint === 0 && settings.contrast === 1 &&
    p.l >= settings.shadow - 1e-6 && p.l <= settings.highlight + 1e-6)
    return rgb(input)!;
  const contrastL = settings.midtone + (p.l - settings.midtone) * settings.contrast;
  const l = clamp(contrastL, settings.shadow, settings.highlight);
  const shadowFactor = settings.asymmetric ? (l - 0.5) * 2 : 1;
  const target: Color = { mode: "oklab", l,
    a: p.a + settings.tint * 0.035,
    b: p.b + settings.warm * 0.035 * shadowFactor };
  return clampChroma(target, "oklch");
}
export function applyLook(hex: string, settings: Studio): string {
  return formatHex(lookColor(hex, settings)).toUpperCase();
}
export function wheelColor(hue: number, wheel: Wheel): string {
  if (wheel === "oklch") return oklchHex(0.7, 0.14, hue);
  const h = wheel === "ryb" ? piecewise(hue, uniform, rybHsl) : hue;
  return formatHex(wheel === "hsv" ? { mode: "hsv", h, s: 0.8, v: 0.85 }
    : { mode: "hsl", h, s: 0.8, l: 0.6 }).toUpperCase();
}
export function recommend(studio: Studio): Recommendation[] {
  if (!validateStudio(studio)) throw new Error("스튜디오의 색·좌표·보정 한계 설정이 잘못되었습니다.");
  if (studio.anchors.length > 16 || studio.count < Math.max(5, studio.anchors.length) ||
    studio.count > 16) throw new Error("색 개수는 입력색 이상이며 5~16개여야 합니다.");
  const anchors = studio.anchors;
  const conceptHex = conceptSeed(studio.concept);
  const bases = anchors.length ? anchors.map(a => a.originalHex) : [conceptHex];
  const neutral = bases.every(h => colorParts(h).c < 0.01) &&
    studio.harmony === "monochromatic";
  const moodC = studio.concept.moods.reduce((sum, mood) =>
    sum + ({ calm: 0.07, playful: 0.18, elegant: 0.09,
      fresh: 0.14, bold: 0.21, natural: 0.085 }[mood]), 0) /
    Math.max(1, studio.concept.moods.length);
  const intentC = studio.intent === "inferred" ? moodC :
    { calm: 0.065, bold: 0.21, natural: 0.085, elegant: 0.09 }[studio.intent];
  const saturationScale = { muted: 0.6, balanced: 1, vivid: 1.4 }[studio.concept.saturation];
  const domainScale = studio.domain === "fashion" ? 0.55 :
    studio.domain === "cinema" ? 0.85 : 1;
  const useScales: Record<string, number> = { web: 1, publication: 0.85,
    powerPoint: 1.08, editor: 1.12, terminal: 1.2 };
  const useScale = studio.concept.useCases.length ? studio.concept.useCases.reduce(
    (sum, use) => sum + (useScales[use] ?? 1), 0) / studio.concept.useCases.length : 1;
  const targetC = neutral || studio.concept.hueDirection === "neutral" ? 0 :
    intentC * saturationScale * domainScale * useScale;
  const look = { ...studio, warm: clamp(studio.warm +
    (neutral ? 0 : studio.concept.hueDirection === "warm" ? 0.35 : studio.concept.hueDirection === "cool" ? -0.35 : 0), -1, 1) };
  return ["원색의 관계", "명도 위계", "강조의 균형"].map((name, variant) => {
    const warnings: string[] = [];
    const colors: string[] = Array(studio.count);
    anchors.forEach((a, i) => {
      const p = colorParts(a.originalHex);
      const scale = [1, 0.85, 0.65][variant];
      const desiredL = p.l + (variant === 1 ? (i % 2 ? 0.07 : -0.04) :
        studio.concept.lightness === "dark" ? -0.05 :
          studio.concept.lightness === "light" ? 0.05 : 0);
      const target = applyLook(oklchHex(desiredL,
        neutral ? 0 : p.c * scale + (targetC - p.c) * 0.25, p.h), look);
      colors[Number(a.id.slice(1)) - 1] = bounded(a, target);
    });
    const offsets = rotations[studio.harmony];
    for (let index = 0, added = 0; index < studio.count; index++) {
      if (colors[index]) continue;
      const base = bases[added % bases.length];
      const modeShift = studio.concept.lightness === "dark" ? -0.07 :
        studio.concept.lightness === "light" ? 0.07 : 0;
      const l = [studio.theme === "dark" ? studio.shadow : studio.highlight,
        studio.theme === "dark" ? studio.highlight : studio.shadow,
        studio.midtone + modeShift - variant * 0.035,
        studio.midtone + 0.16 + modeShift][added % 4];
      const offset = offsets[(added + 1) % offsets.length];
      const generatedC = targetC * studio.surroundingChroma * (variant === 2 ? 0.6 : variant === 1 ? 0.9 : 1);
      let hex = rotate(base, offset + (studio.generation % 9) *
        (studio.harmony === "monochromatic" ? 0 : 3), studio.wheel,
        l, generatedC);
      if (l < 0.25 && studio.tintedShadow && !neutral)
        hex = oklchHex(l, Math.min(0.035, generatedC), colorParts(base).h + 30);
      hex = applyLook(hex, look);
      for (let attempt = 1; attempt <= 16 && colors.includes(hex); attempt++) {
        hex = applyLook(rotate(base, offset, studio.wheel,
          clamp(l + (attempt % 2 ? -1 : 1) * Math.ceil(attempt / 2) * 0.025), generatedC), look);
      }
      for (let attempt = 0; attempt < 24 && studio.concept.avoidHexes.some(
        avoided => deltaOK(avoided, hex) < 0.08); attempt++) {
        hex = rotate(base, offset + attempt * 29 + 29, studio.wheel,
          clamp(l + (attempt % 3) * 0.06), generatedC);
        hex = applyLook(hex, look);
      }
      colors[index] = hex;
      added++;
    }
    colors.forEach((hex, i) => {
      if (studio.concept.avoidHexes.some(a => deltaOK(a, hex) < 0.08))
        warnings.push(`${i + 1}번 색이 회피 범위(ΔEOK < 0.08)와 겹칩니다. 고정 또는 보정 한계를 바꿔 확인하세요.`);
    });
    if (anchors.some(a => a.locked && (colorParts(a.fixedHex ?? a.originalHex).l < studio.shadow ||
      colorParts(a.fixedHex ?? a.originalHex).l > studio.highlight)))
      warnings.push("고정색이 선택한 명도 범위 밖에 있어 고정 목표색을 우선 보존했습니다.");
    if (anchors.length === studio.count && anchors.every(a => a.locked))
      warnings.push("출력색이 모두 고정되어 후보의 색값이 같습니다. 유연색을 허용하거나 출력 색 개수를 늘려 비교하세요.");
    const changes = anchors.map(a => ({ id: a.id,
      original: a.originalHex, hex: colors[Number(a.id.slice(1)) - 1],
      delta: deltaOK(a.originalHex, colors[Number(a.id.slice(1)) - 1]),
      reason: a.locked ? `고정 목표 ${a.fixedHex ?? a.originalHex}를 정확히 보존` : colors[Number(a.id.slice(1)) - 1] === a.originalHex
        ? "보정 한계 안에서 원색 유지" : `${name} 의도에 따라 명도·채도를 보정 (원색 기준)` }));
    return { name, colors, changes, warnings };
  });
}

export function paletteWarnings(studio: Studio, colors: string[]): string[] {
  const warnings: string[] = [];
  colors.forEach((hex, i) => {
    if (studio.concept.avoidHexes.some(a => deltaOK(a, hex) < 0.08))
      warnings.push(`${i + 1}번 색이 회피 범위(ΔEOK < 0.08)와 겹칩니다.`);
  });
  for (const a of studio.anchors) {
    const color = colors[Number(a.id.slice(1)) - 1];
    if (!color || !withinBounds(a, color)) warnings.push(`${a.id}의 색 고정 또는 보정 한계를 확인하세요.`);
    if (a.locked && color && (colorParts(color).l < studio.shadow || colorParts(color).l > studio.highlight))
      warnings.push(`${a.id} 고정색이 명도 범위 밖에 있어 고정 목표색을 우선 보존했습니다.`);
  }
  return warnings;
}

export function mapStops(studio: Studio, swatches: { id: string; hex: string }[]): ColorStop[] {
  const ordered = [...swatches];
  if (studio.mapKind === "sequential" && !studio.anchors.some(a => a.positionLocked))
    ordered.sort((a, b) => colorParts(a.hex).l - colorParts(b.hex).l);
  if (studio.mapKind === "diverging" && !studio.anchors.some(a => a.positionLocked)) {
    ordered.sort((a, b) => colorParts(a.hex).l - colorParts(b.hex).l);
    const high = ordered.pop();
    const left = ordered.filter((_, i) => i % 2 === 0);
    const right = ordered.filter((_, i) => i % 2 === 1).reverse();
    ordered.splice(0, ordered.length, ...left, ...(high ? [high] : []), ...right);
  }
  const pivot = ordered.reduce((best, current, i) =>
    colorParts(current.hex).l > colorParts(ordered[best].hex).l ? i : best, 0);
  return ordered.map((s, index) => ({ ...s,
    t: studio.anchors.find(a => a.id === s.id && a.positionLocked)?.t ??
      (studio.mapKind === "diverging" && pivot > 0 && pivot < ordered.length - 1
        ? index <= pivot ? 0.5 * index / pivot :
          0.5 + 0.5 * (index - pivot) / (ordered.length - 1 - pivot)
        : index / Math.max(1, ordered.length - (studio.mapKind === "cyclic" ? 0 : 1))),
  })).sort((a, b) => a.t - b.t);
}
export function evaluateMap(stops: ColorStop[], t: number, studio: Studio): string {
  if (!stops.length) throw new Error("colormap에 색이 없습니다.");
  const exact = stops.find(s => Math.abs(s.t - t) < 1e-12);
  if (exact) return exact.hex;
  if (studio.mapKind === "qualitative") {
    return stops.reduce((a, b) => Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b).hex;
  }
  const points = studio.mapKind === "cyclic"
    ? [...stops, { ...stops[0], t: 1 }] : stops;
  if (t <= points[0].t) return points[0].hex;
  for (let i = 1; i < points.length; i++) if (t <= points[i].t) {
    const a = points[i - 1];
    const b = points[i];
    return mixColors(a.hex, b.hex, (t - a.t) / (b.t - a.t), studio.mixModel);
  }
  return points.at(-1)!.hex;
}
export function validateMap(stops: ColorStop[], studio: Studio): string[] {
  const warnings: string[] = [];
  for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i].t - stops[i - 1].t) < 1e-12 &&
    stops[i].hex !== stops[i - 1].hex) warnings.push("같은 위치에 서로 다른 색이 있습니다. 위치 잠금을 조정하세요.");
  if (studio.mapKind === "cyclic" && stops.some(s => s.t === 1 && s.hex !== stops[0].hex))
    warnings.push("cyclic의 끝 색과 시작 색이 다릅니다. 끝 위치 잠금을 해제하세요.");
  if (warnings.length) return warnings;
  if (studio.mapKind === "sequential" || studio.mapKind === "diverging") {
    const ls = Array.from({ length: 257 }, (_, i) => colorParts(evaluateMap(stops, i / 256, studio)).l);
    const pivot = studio.mapKind === "diverging"
      ? ls.indexOf(Math.max(...ls)) : ls.length - 1;
    if (studio.mapKind === "diverging" && Math.abs(pivot / 256 - 0.5) > 0.02)
      warnings.push("발산형은 중심 t=0.5에 명도 정점을 둡니다. 위치 잠금 또는 색 순서를 조정하세요.");
    let high = ls[0];
    let low = ls[pivot];
    const reversed = ls.some((l, i) => {
      if (i <= pivot) { const fail = l + 0.006 < high; high = Math.max(high, l); return fail; }
      const fail = l - 0.006 > low; low = Math.min(low, l); return fail;
    });
    if (reversed)
      warnings.push("고정 위치 또는 혼합 방식 때문에 명도가 단조롭게 이어지지 않습니다.");
  }
  return warnings;
}
export function sampleMap(stops: ColorStop[], studio: Studio, count = 256): ColorStop[] {
  if (!Number.isInteger(count) || count < 2) throw new Error("표본 수는 2 이상이어야 합니다.");
  const warnings = validateMap(stops, studio);
  if (warnings.length) throw new Error(warnings.join(" "));
  const positions = [...new Set([...Array.from({ length: count },
    (_, i) => i / (count - 1)), ...stops.map(s => s.t)])].sort((a, b) => a - b);
  return positions.map(t => ({ t, hex: evaluateMap(stops, t, studio),
    id: stops.filter(s => Math.abs(s.t - t) < 1e-12).map(s => s.id).join("|") || "sample" }));
}

export const coordinateModes = ["rgb", "hsl", "hsv", "oklab", "oklch", "lab", "lch"] as const;
export type CoordinateMode = typeof coordinateModes[number];
export function coordinates(hex: string, mode: CoordinateMode): string {
  const c = converter(mode)(hex)!;
  const keys = mode === "rgb" ? ["r", "g", "b"] : mode === "hsv" ? ["h", "s", "v"] :
    mode === "hsl" ? ["h", "s", "l"] : mode.endsWith("lch") ? ["l", "c", "h"] : ["l", "a", "b"];
  return keys.map(k => {
    const n = (c as unknown as Record<string, number>)[k];
    return `${k}=${n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(4)}`;
  }).join("  ");
}
export function validateStudio(value: unknown): value is Studio {
  if (!value || typeof value !== "object") return false;
  const s = value as Studio;
  const validNum = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  return Array.isArray(s.anchors) && s.anchors.length <= 16 &&
    s.anchors.every(a => a && /^s[1-9]\d*$/.test(a.id) && Number(a.id.slice(1)) <= s.count && !!normalizeHex(a.originalHex) &&
      (a.fixedHex === undefined || !!normalizeHex(a.fixedHex)) &&
      typeof a.locked === "boolean" && typeof a.positionLocked === "boolean" &&
      validNum(a.t, 0, 1) && validNum(a.maxDelta, 0, 0.3) &&
      validNum(a.maxL, 0, 1) && validNum(a.maxC, 0, 0.4) && validNum(a.maxH, 0, 180)) &&
    new Set(s.anchors.map(a => a.id)).size === s.anchors.length &&
    Number.isInteger(s.count) && s.count >= Math.max(5, s.anchors.length) && s.count <= 16 &&
    ["oklch", "hsl", "hsv", "ryb"].includes(s.wheel) &&
    coordinateModes.includes(s.editingSpace) &&
    ["light", "dark"].includes(s.theme) && ["ui", "cinema", "brand", "fashion"].includes(s.domain) &&
    ["inferred", "calm", "bold", "natural", "elegant"].includes(s.intent) &&
    Object.keys(rotations).includes(s.harmony) &&
    ["qualitative", "sequential", "diverging", "cyclic"].includes(s.mapKind) &&
    ["perceptual", "additive", "average", "subtractive"].includes(s.mixModel) &&
    validNum(s.warm, -1, 1) && validNum(s.tint, -1, 1) &&
    validNum(s.shadow, 0, 1) && validNum(s.midtone, s.shadow, s.highlight) &&
    validNum(s.highlight, s.shadow, 1) && validNum(s.contrast, 0.3, 1.8) &&
    validNum(s.surroundingChroma, 0, 1) &&
    [s.asymmetric, s.tintedShadow, s.texture].every(v => typeof v === "boolean") &&
    Array.isArray(s.area) && s.area.length === 3 && s.area.every(a => validNum(a, 0, 100)) &&
    s.area.reduce((a, b) => a + b, 0) > 0 && Number.isSafeInteger(s.generation) && s.generation >= 0 &&
    (s.recipeId === null || typeof s.recipeId === "string") && !!s.concept &&
    Array.isArray(s.concept.moods) && s.concept.moods.every(m =>
      ["calm", "playful", "elegant", "fresh", "bold", "natural"].includes(m)) &&
    Array.isArray(s.concept.useCases) && s.concept.useCases.every(u => typeof u === "string") &&
    ["warm", "cool", "neutral", "any"].includes(s.concept.hueDirection) &&
    ["light", "balanced", "dark"].includes(s.concept.lightness) &&
    ["muted", "balanced", "vivid"].includes(s.concept.saturation) &&
    Array.isArray(s.concept.avoidHexes) && s.concept.avoidHexes.every(h => !!normalizeHex(h)) &&
    typeof s.concept.note === "string";
}
