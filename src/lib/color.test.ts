import { describe, expect, it } from "vitest";
import {
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
