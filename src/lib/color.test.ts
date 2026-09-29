import { describe, expect, it } from "vitest";
import {
  colorParts,
  conceptSeed,
  contrastRatio,
  generateCandidates,
  normalizeHex,
  suggestTextColor,
} from "./color";

describe("palette rules", () => {
  it("keeps the exact input color and produces three distinct five-color candidates", () => {
    const candidates = generateCandidates("#336699", "triadic");
    expect(candidates).toHaveLength(3);
    expect(
      candidates.every(
        (colors) => colors.length === 5 && colors[0] === "#336699",
      ),
    ).toBe(true);
    expect(new Set(candidates.map((colors) => colors.join(","))).size).toBe(3);
    expect(candidates.flat().every((hex) => normalizeHex(hex) === hex)).toBe(
      true,
    );
  });

  it("offers noticeably different tones for every harmony while keeping usable text contrast", () => {
    const harmonies = [
      "monochromatic",
      "analogous",
      "complementary",
      "splitComplementary",
      "triadic",
      "tetradic",
    ] as const;
    for (const seed of ["#336699", "#B5742A"]) {
      for (const harmony of harmonies) {
        const candidates = generateCandidates(seed, harmony);
        const surfaceLightness = candidates.map((colors) => colorParts(colors[1]).l);
        const accentLightness = candidates.map((colors) => colorParts(colors[3]).l);
        expect(surfaceLightness[0] - surfaceLightness[1]).toBeGreaterThan(0.025);
        expect(surfaceLightness[1] - surfaceLightness[2]).toBeGreaterThan(0.08);
        expect(accentLightness[0] - accentLightness[1]).toBeGreaterThan(0.1);
        expect(accentLightness[1] - accentLightness[2]).toBeGreaterThan(0.12);
        expect(candidates.every((colors) => colors[0] === seed)).toBe(true);
        expect(
          candidates.every((colors) => contrastRatio(colors[2], colors[1]) >= 4.5),
        ).toBe(true);
        expect(generateCandidates(seed, harmony, 1)).toEqual(
          generateCandidates(seed, harmony, 1),
        );
        expect(generateCandidates(seed, harmony, 1)).not.toEqual(candidates);
      }
    }
  });

  it("uses concept choices deterministically and changes the seed when the direction changes", () => {
    const input = {
      useCases: ["web"],
      moods: [],
      hueDirection: "warm" as const,
      lightness: "balanced" as const,
      saturation: "muted" as const,
      avoidHexes: [],
      note: "",
    };
    expect(conceptSeed(input)).toBe(conceptSeed(input));
    expect(conceptSeed(input)).not.toBe(
      conceptSeed({ ...input, hueDirection: "cool" }),
    );
  });

  it("checks known contrast bounds and offers a passing adjustment", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeLessThan(4.5);
    const suggested = suggestTextColor("#777777", "#FFFFFF");
    expect(contrastRatio(suggested, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});
