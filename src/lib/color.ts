import { clampChroma, converter, formatHex } from "culori";

export type Harmony =
  | "monochromatic"
  | "analogous"
  | "complementary"
  | "splitComplementary"
  | "triadic"
  | "tetradic";

export type HueDirection = "warm" | "cool" | "neutral" | "any";
export type Lightness = "light" | "balanced" | "dark";
export type Saturation = "muted" | "balanced" | "vivid";
export type Mood =
  | "calm"
  | "playful"
  | "elegant"
  | "fresh"
  | "bold"
  | "natural";

export interface ConceptInput {
  useCases: string[];
  moods: Mood[];
  hueDirection: HueDirection;
  lightness: Lightness;
  saturation: Saturation;
  avoidHexes: string[];
  note: string;
}

const toOklch = converter("oklch");

export function normalizeHex(input: string): string | null {
  const value = input.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(value) ? value : null;
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function oklchHex(l: number, c: number, h: number): string {
  const mapped = clampChroma(
    {
      mode: "oklch" as const,
      l: Math.max(0, Math.min(1, l)),
      c: Math.max(0, c),
      h: wrapHue(h),
    },
    "oklch",
  );
  return formatHex(mapped).toUpperCase();
}

export function colorParts(hex: string): { l: number; c: number; h: number } {
  const parsed = toOklch(hex);
  if (!parsed) throw new Error("유효하지 않은 색상입니다.");
  return { l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 220 };
}

export function tone(
  hex: string,
  hueOffset: number,
  lightness: number,
  chroma?: number,
): string {
  const source = colorParts(hex);
  return oklchHex(
    lightness,
    chroma ?? source.c,
    source.h + hueOffset,
  );
}

const moodHue: Record<Mood, number> = {
  calm: 220,
  playful: 34,
  elegant: 292,
  fresh: 154,
  bold: 14,
  natural: 120,
};

const directionHue: Record<HueDirection, number> = {
  warm: 32,
  cool: 218,
  neutral: 125,
  any: 262,
};

const lightnessValue: Record<Lightness, number> = {
  light: 0.72,
  balanced: 0.57,
  dark: 0.43,
};

const chromaValue: Record<Saturation, number> = {
  muted: 0.065,
  balanced: 0.13,
  vivid: 0.21,
};

export function conceptSeed(input: ConceptInput): string {
  const x = input.moods.reduce((sum, m) => sum + Math.cos(moodHue[m] * Math.PI / 180), 0);
  const y = input.moods.reduce((sum, m) => sum + Math.sin(moodHue[m] * Math.PI / 180), 0);
  let hue = input.moods.length
    ? wrapHue(Math.atan2(y, x) * 180 / Math.PI)
    : directionHue[input.hueDirection];
  if (input.hueDirection === "warm" && hue > 95 && hue < 315) hue = 32;
  if (input.hueDirection === "cool" && (hue < 110 || hue > 305)) hue = 218;
  if (input.hueDirection === "neutral") hue = directionHue.neutral;

  const avoidHues = input.avoidHexes.map((hex) => colorParts(hex).h);
  for (
    let attempt = 0;
    attempt < 12 &&
    avoidHues.some(
      (avoided) => Math.abs(((hue - avoided + 540) % 360) - 180) < 24,
    );
    attempt += 1
  ) {
    hue = wrapHue(hue + 53);
  }
  return oklchHex(
    lightnessValue[input.lightness],
    chromaValue[input.saturation],
    hue,
  );
}

const harmonyOffsets: Record<Harmony, [number, number]> = {
  monochromatic: [0, 0],
  analogous: [-30, 30],
  complementary: [180, 165],
  splitComplementary: [-150, 150],
  triadic: [-120, 120],
  tetradic: [90, 180],
};

export const candidateStyles = [
  {
    name: "은은한",
    detail: "밝은 바탕 · 절제된 포인트",
    surfaceL: 0.975,
    surfaceC: 0.012,
    inkL: 0.3,
    accentL: [0.76, 0.69],
    accentScale: 0.48,
    analogousSpread: 1,
  },
  {
    name: "선명한",
    detail: "깨끗한 바탕 · 뚜렷한 포인트",
    surfaceL: 0.935,
    surfaceC: 0.028,
    inkL: 0.21,
    accentL: [0.61, 0.57],
    accentScale: 1,
    analogousSpread: 1.5,
  },
  {
    name: "깊은",
    detail: "색감 있는 바탕 · 묵직한 포인트",
    surfaceL: 0.82,
    surfaceC: 0.06,
    inkL: 0.13,
    accentL: [0.42, 0.52],
    accentScale: 1.28,
    analogousSpread: 2,
  },
] as const;

export function generateCandidates(
  seedInput: string,
  harmony: Harmony,
  generation = 0,
): string[][] {
  const seed = normalizeHex(seedInput);
  if (!seed) throw new Error("HEX 색상은 #RRGGBB 형식이어야 합니다.");
  const base = colorParts(seed);
  const offsets = harmonyOffsets[harmony];

  return candidateStyles.map((style) => {
    const cycle = generation % 5;
    const hueDrift = harmony === "monochromatic" ? 0 : (generation % 7) * 3;
    const spread = harmony === "analogous" ? style.analogousSpread : 1;
    const accentC = Math.min(
      0.24,
      Math.max(0.11, base.c * 1.25 + 0.035) * style.accentScale,
    );
    const light = oklchHex(
      style.surfaceL - cycle * 0.006,
      style.surfaceC,
      base.h + offsets[0] * 0.15,
    );
    const dark = oklchHex(style.inkL + cycle * 0.004, 0.035, base.h);
    const fourth = oklchHex(
      style.accentL[0] - cycle * 0.008,
      accentC,
      base.h + offsets[0] * spread + hueDrift,
    );
    const fifth = oklchHex(
      style.accentL[1] + cycle * 0.008,
      accentC,
      base.h + offsets[1] * spread - hueDrift,
    );
    return [seed, light, dark, fourth, fifth];
  });
}

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const valid = normalizeHex(hex);
  if (!valid) throw new Error("유효하지 않은 색상입니다.");
  const r = linearChannel(Number.parseInt(valid.slice(1, 3), 16));
  const g = linearChannel(Number.parseInt(valid.slice(3, 5), 16));
  const b = linearChannel(Number.parseInt(valid.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function suggestTextColor(
  foreground: string,
  background: string,
  minimum = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minimum) return foreground;
  const source = colorParts(foreground);
  let best: { hex: string; distance: number } | null = null;
  for (let step = 8; step <= 96; step += 1) {
    const l = step / 100;
    const hex = oklchHex(l, Math.min(source.c, 0.13), source.h);
    if (contrastRatio(hex, background) < minimum) continue;
    const distance = Math.abs(l - source.l);
    if (!best || distance < best.distance) best = { hex, distance };
  }
  if (best) return best.hex;
  return contrastRatio("#000000", background) >=
    contrastRatio("#FFFFFF", background)
    ? "#000000"
    : "#FFFFFF";
}
