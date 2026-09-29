import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateCandidates } from "./color";
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
  saveProject,
  setRoleOverride,
  setRoleSwatch,
  setSwatchHex,
  setSwatchLock,
  STORAGE_KEY,
} from "./project";

const source = {
  kind: "baseColor" as const,
  hex: "#336699",
  harmony: "analogous" as const,
  generationIndex: 0,
};
const candidates = generateCandidates(source.hex, source.harmony);
const project = () => createProject(source, candidates[0]);

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe("project invariants", () => {
  it("preserves the locked input and explicit role edits across candidates and regeneration", () => {
    let current = project();
    expect(current.swatches[0]).toMatchObject({
      hex: "#336699",
      origin: "input",
      locked: true,
    });
    expect(() => setSwatchHex(current, "s1", "#123456")).toThrow(/잠금/);
    current = setRoleOverride(current, "web", "primary", "#654321");
    current = chooseCandidate(current, candidates[1]);
    expect(current.swatches.find((item) => item.id === "s1")?.hex).toBe(
      "#336699",
    );
    expect(getRoleHex(current, "web", "primary")).toBe("#654321");
    const next = regenerate(current);
    expect(next.project.swatches.find((item) => item.id === "s1")?.hex).toBe(
      "#336699",
    );
    expect(getRoleHex(next.project, "web", "primary")).toBe("#654321");
    expect(
      next.project.source.kind === "baseColor" &&
        next.project.source.generationIndex,
    ).toBe(1);
  });

  it("keeps role links bound to swatch IDs after reordering and updates the source when unlocked input changes", () => {
    let current = project();
    current = setRoleSwatch(current, "web", "primary", "s5");
    const color = getRoleHex(current, "web", "primary");
    current = moveSwatch(current, "s5", -1);
    expect(getRoleHex(current, "web", "primary")).toBe(color);
    current = setSwatchLock(current, "s1", false);
    current = setSwatchHex(current, "s1", "#123456");
    expect(current.source.kind === "baseColor" && current.source.hex).toBe(
      "#123456",
    );
    expect(current.swatches.find((item) => item.id === "s1")?.origin).toBe(
      "input",
    );
  });

  it("round-trips JSON and CSS with role overrides", () => {
    const current = setRoleOverride(project(), "terminal", "red", "#AA3344");
    const restored = parseProject(exportProject(current));
    expect(restored).toEqual(current);
    expect(exportCss(restored)).toContain("--colors-terminal-red: #AA3344;");
    expect(exportCss(restored)).toContain("--colors-power-point-accent1:");
  });

  it("imports the documented example and defaults its older missing generation index", () => {
    const example = readFileSync(
      new URL(
        "../../.worknotes/examples/locked-base-color.json",
        import.meta.url,
      ),
      "utf8",
    );
    const imported = parseProject(example);
    expect(
      imported.source.kind === "baseColor" && imported.source.generationIndex,
    ).toBe(0);
    expect(
      regenerate(imported).project.swatches.find((item) => item.id === "s1")
        ?.hex,
    ).toBe("#336699");
  });

  it("rejects broken references and invalid source values", () => {
    const invalidReference = JSON.parse(exportProject(project()));
    invalidReference.roleSets.web.text.swatchId = "missing";
    expect(() => parseProject(JSON.stringify(invalidReference))).toThrow(
      /역할 참조/,
    );
    const invalidSource = JSON.parse(exportProject(project()));
    invalidSource.source.generationIndex = "invalid";
    expect(() => parseProject(JSON.stringify(invalidSource))).toThrow(
      /생성 순서/,
    );
  });

  it("persists and deletes projects in browser-like storage", () => {
    const storage = memoryStorage();
    const current = project();
    saveProject(current, storage);
    saveProject(setSwatchLock(current, "s2", true), storage);
    expect(loadProjects(storage)).toHaveLength(1);
    expect(loadProjects(storage)[0].swatches[1].locked).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toContain(current.projectId);
    deleteProject(current.projectId, storage);
    expect(loadProjects(storage)).toHaveLength(0);
  });
});
