import { describe, expect, it } from "vitest";
import { colorParts, conceptSeed, contrastRatio } from "./color";
import { createProject, deleteProject, exportProject, getRoleHex, makeRoleSets, parseProject,
  regenerate, roleContrastPairs, setRoleSwatch, setSwatchLock } from "./project";
import { createAnchor, defaultStudio, deltaOK, evaluateMap, mapStops,
  mixColors, parseColor, recommend, sampleMap, validateMap, withinBounds, paletteWarnings } from "./studio";

const input = ["#336699", "#E05566", "#336699"];
const config = () => defaultStudio(input.map((hex, i) => createAnchor(hex, i, input.length)));
const project = () => {
  const studio = config();
  return createProject({ kind: "baseColor", hex: input[0], harmony: "analogous", generationIndex: 0 }, recommend(studio)[0].colors, studio);
};
describe("constrained recommendations", () => {
  it("preserves every input identity, duplicate color and a later generated lock", () => {
    for (const count of [1, 5, 8, 12]) {
      const s = defaultStudio(Array.from({ length: count }, (_, i) => createAnchor(input[i % 3], i, count)));
      for (const option of recommend(s))
        s.anchors.forEach((a, i) => expect(option.colors[i]).toBe(a.originalHex));
    }
    let p = project();
    p = setSwatchLock(p, "s6", true);
    const next = regenerate(p).project;
    expect(next.swatches.find(s => s.id === "s6")!.hex).toBe(p.swatches[5].hex);
    expect(parseProject(exportProject(next))).toEqual(next);
  });
  it("projects all candidates into original soft limits without cumulative drift", () => {
    let p = project();
    p = setSwatchLock(p, "s1", false);
    p.studio = { ...p.studio, warm: 1, tint: -1, contrast: 1.8, intent: "bold" };
    for (let i = 0; i < 30; i++) {
      p = regenerate(p).project;
      const a = p.studio.anchors[0];
      expect(a.originalHex).toBe(input[0]);
      expect(withinBounds(a, p.swatches[0].hex)).toBe(true);
      expect(deltaOK(input[0], p.swatches[0].hex)).toBeLessThanOrEqual(a.maxDelta);
    }
    p = setSwatchLock(p, "s1", true);
    const fixed = p.swatches[0].hex;
    expect(regenerate(p).project.swatches[0].hex).toBe(fixed);
    expect(recommend(p.studio)[0].changes[0].reason).toContain(fixed);
    p = setSwatchLock(p, "s1", false);
    expect(p.studio.anchors[0].originalHex).toBe(input[0]);
  });
  it("uses combined moods/use cases and detects avoidance conflicts", () => {
    const s = defaultStudio([]);
    const a = recommend(s)[0].colors;
    const changed = { ...s, concept: { ...s.concept, moods: ["calm", "bold"] as const as unknown as typeof s.concept.moods,
      useCases: ["web", "terminal"] } };
    expect(conceptSeed(changed.concept)).not.toBe(conceptSeed(s.concept));
    expect(recommend(changed)[0].colors).not.toEqual(a);
    const fixed = config(); fixed.concept.avoidHexes = [input[0]];
    expect(recommend(fixed)[0].warnings.join(" ")).toContain("회피");
    expect(recommend(fixed)[0].colors[0]).toBe(input[0]);
  });
  it("reflects warm/cool direction and surrounding chroma even with only one generated color", () => {
    const s = defaultStudio(Array.from({ length: 5 }, (_, i) => createAnchor(input[i % 3], i, 5)));
    const warm = recommend({ ...s, concept: { ...s.concept, hueDirection: "warm" } });
    const cool = recommend({ ...s, concept: { ...s.concept, hueDirection: "cool" } });
    expect(warm.map(c => c.colors)).not.toEqual(cool.map(c => c.colors));
    for (const c of [...warm, ...cool]) expect(c.colors.slice(0, 5)).toEqual(s.anchors.map(a => a.originalHex));
    const normal = recommend(s)[0].colors[5];
    const low = recommend({ ...s, surroundingChroma: 0 })[0].colors[5];
    expect(colorParts(low).c).toBeLessThan(colorParts(normal).c);
    expect(paletteWarnings({ ...s, concept: { ...s.concept, avoidHexes: ["#FF0000"] } },
      [...recommend(s)[0].colors.slice(0, 5), "#FF0000"]).join(" ")).toContain("6번 색");
  });
  it("rejects incomplete scenes, normalizes restored fields and backs up deletion migration", () => {
    const p = project();
    const bad = { ...p, sequence: [{ id: "bad", name: "bad" }] };
    expect(() => parseProject(JSON.stringify(bad))).toThrow(/장면/);
    p.sequence = [{ id: "scene1", name: "첫 장면", swatches: structuredClone(p.swatches),
      roleSets: structuredClone(p.roleSets), studio: structuredClone(p.studio) }];
    p.sequence[0].swatches[1].hex = "#E05566".toLowerCase();
    p.sequence[0].studio.anchors[1].originalHex = "#E05566".toLowerCase();
    expect(parseProject(exportProject(p)).sequence[0].swatches[1].hex).toBe("#E05566");
    const legacy = { ...project(), schemaVersion: 1, studio: undefined, sequence: undefined };
    const original = JSON.stringify([legacy]);
    const data = new Map([["colors.projects.v1", original]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value) } as unknown as Storage;
    deleteProject(legacy.projectId, storage);
    expect(data.get("colors.projects.v1.backup")).toBe(original);
    expect(data.get("colors.projects.v1")).toBe("[]");
  });
  it("keeps neutral monochromatic colors achromatic and all four tetradic axes", () => {
    const neutral = defaultStudio([createAnchor("#808080", 0)], undefined, "monochromatic");
    expect(recommend(neutral).flatMap(c => c.colors).every(c => colorParts(c).c < 0.001)).toBe(true);
    neutral.concept.hueDirection = "cool";
    expect(recommend(neutral).flatMap(c => c.colors).every(c => colorParts(c).c < 0.001)).toBe(true);
    const tetradic = defaultStudio([createAnchor("#336699", 0)], undefined, "tetradic");
    const hues = recommend(tetradic)[0].colors.map(c => colorParts(c).h);
    expect(new Set(hues.map(h => Math.round(h / 30))).size).toBeGreaterThanOrEqual(4);
  });
  it("validates opaque CSS input and rejects malformed imported settings/results", () => {
    expect(parseColor("rebeccapurple")).toBe("#663399");
    expect(parseColor("rgba(1, 2, 3, 0.5)")).toBeNull();
    expect(parseColor("not a color")).toBeNull();
    const p = JSON.parse(exportProject(project()));
    p.studio.anchors[0].maxDelta = -1;
    expect(() => parseProject(JSON.stringify(p))).toThrow(/스튜디오/);
    p.studio.anchors[0].maxDelta = 0.05;
    p.swatches[0].hex = "#AAAAAA";
    expect(() => parseProject(JSON.stringify(p))).toThrow(/앵커/);
  });
  it("preserves manual role bindings and recalculates automatic contrast roles", () => {
    let p = setRoleSwatch(project(), "web", "primary", "s3");
    p = regenerate(p).project;
    expect(p.roleSets.web.primary.swatchId).toBe("s3");
    expect(parseProject(exportProject(p)).roleSets.web.primary.reason).toBe("userBinding");
    for (const theme of ["light", "dark"] as const) {
      const studio = { ...config(), theme };
      const colors = recommend(studio)[0].colors;
      const p = { ...project(), swatches: project().swatches.map((s, i) => ({ ...s, hex: colors[i] })),
        roleSets: makeRoleSets(colors, studio) };
      for (const [set, pairs] of Object.entries(roleContrastPairs))
        for (const pair of pairs)
          expect(contrastRatio(getRoleHex(p, set as keyof typeof roleContrastPairs, pair.foreground),
            getRoleHex(p, set as keyof typeof roleContrastPairs, pair.background)),
          `${theme}/${set}/${pair.foreground}`).toBeGreaterThanOrEqual(pair.minimum);
    }
  });
});
describe("colormap functions", () => {
  it("evaluates exact anchors at arbitrary t and exports all identities", () => {
    const s = config(); s.mapKind = "sequential";
    const stops = [{ id: "s1", t: 0, hex: "#101010" },
      { id: "s2", t: 0.3, hex: "#808080" }, { id: "s3", t: 1, hex: "#EEEEEE" }];
    expect(evaluateMap(stops, 0.3, s)).toBe("#808080");
    const samples = sampleMap(stops, s);
    expect(samples.find(x => x.t === 0.3)?.hex).toBe("#808080");
    const duplicate = sampleMap([...stops, { id: "s4", t: 1, hex: "#EEEEEE" }], s);
    expect(duplicate.at(-1)!.id).toBe("s3|s4");
  });
  it("rejects collisions and scientific path conflicts without moving fixed anchors", () => {
    const s = config(); s.mapKind = "sequential";
    const collision = [{ id: "s1", t: 0, hex: "#101010" }, { id: "s2", t: 0, hex: "#EEEEEE" }];
    expect(() => sampleMap(collision, s)).toThrow(/같은 위치/);
    const reversed = [{ id: "s1", t: 0, hex: "#EEEEEE" }, { id: "s2", t: 1, hex: "#101010" }];
    expect(validateMap(reversed, s).join(" ")).toContain("단조");
    expect(() => sampleMap(reversed, s)).toThrow(/단조/);
  });
  it("closes cyclic seam and positions the diverging center at 0.5", () => {
    const p = project(); p.studio.mapKind = "cyclic";
    const stops = mapStops(p.studio, p.swatches);
    expect(evaluateMap(stops, 0, p.studio)).toBe(evaluateMap(stops, 1, p.studio));
    p.studio.mapKind = "diverging";
    const diverging = mapStops(p.studio, p.swatches);
    const high = p.swatches.reduce((a, b) => colorParts(a.hex).l > colorParts(b.hex).l ? a : b);
    expect(diverging.find(s => s.id === high.id)?.t).toBe(0.5);
  });
  it("distinguishes additive mean, light sum and subtractive filters with finite endpoints", () => {
    for (const model of ["perceptual", "average", "additive", "subtractive"] as const) {
      expect(mixColors("#FF0000", "#0000FF", 0, model)).toBe("#FF0000");
      expect(mixColors("#FF0000", "#0000FF", 1, model)).toBe("#0000FF");
    }
    expect(mixColors("#FF0000", "#0000FF", 0.5, "average")).toBe("#BC00BC");
    expect(mixColors("#FF0000", "#0000FF", 0.5, "additive")).toBe("#FF00FF");
    expect(mixColors("#FF0000", "#0000FF", 0.5, "subtractive")).toBe("#000000");
  });
});
