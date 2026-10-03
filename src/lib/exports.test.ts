import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { createProject } from "./project";
import { createAnchor, defaultStudio, recommend } from "./studio";
import { exportAse, exportColormap, exportCube, exportOffice, exportSequence,
  exportSvg, exportTailwind, exportTerminal, exportTokens, exportVsCode } from "./exports";

function project() {
  const s = defaultStudio([createAnchor("#123456", 0), createAnchor("#E05566", 1, 2)]);
  return createProject({ kind: "baseColor", hex: "#123456", harmony: "analogous", generationIndex: 0 }, recommend(s)[0].colors, s);
}
describe("export contracts", () => {
  it("exports current DTCG sRGB tokens and executable Tailwind 3/4 configuration", () => {
    const p = project();
    const tokens = JSON.parse(exportTokens(p));
    expect(tokens.palette.s1.$value.hex).toBe("#123456");
    expect(tokens.palette.s1.$value.components).toEqual([18 / 255, 52 / 255, 86 / 255]);
    expect(tokens.web.onPrimary.$type).toBe("color");
    const module = { exports: {} as { theme: { extend: { colors: { colors: unknown } } } } };
    runInNewContext(exportTailwind(p, 3), { module });
    expect(module.exports.theme.extend.colors.colors).toHaveProperty("on-primary");
    expect(exportTailwind(p, 4)).toContain("--color-colors-on-primary:");
  });
  it("reads every ASE block independently and restores exact sRGB colors", () => {
    const p = project();
    const bytes = exportAse(p);
    const data = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("ASEF");
    expect(data.getUint16(4)).toBe(1);
    expect(data.getUint32(8)).toBe(p.swatches.length);
    let pos = 12;
    const colors: string[] = [];
    while (pos < bytes.length) {
      const type = data.getUint16(pos);
      const end = pos + 6 + data.getUint32(pos + 2);
      expect(type).toBe(1);
      const nameLength = data.getUint16(pos + 6);
      const modelPos = pos + 8 + nameLength * 2;
      expect(new TextDecoder().decode(bytes.slice(modelPos, modelPos + 4))).toBe("RGB ");
      expect(data.getUint16(modelPos + 16)).toBe(0);
      const rgb = [0, 1, 2].map(i => data.getFloat32(modelPos + 4 + i * 4));
      expect(rgb.every(c => Number.isFinite(c) && c >= 0 && c <= 1)).toBe(true);
      colors.push("#" + rgb.map(c => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase());
      expect(end).toBe(modelPos + 18);
      pos = end;
    }
    expect(colors).toEqual(p.swatches.map(s => s.hex));
    expect(pos).toBe(bytes.length);
  });
  it("emits Office's ordered twelve slots and the target application keys", () => {
    const p = project();
    const xml = exportOffice(p);
    expect([...xml.matchAll(/<a:(\w+)><a:srgbClr val="([A-F0-9]{6})"\/>/g)].map(m => m[1]))
      .toEqual(["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]);
    const vscode = JSON.parse(exportVsCode(p));
    expect(vscode.tokenColors.find((s: { scope: string }) => s.scope === "comment").settings.foreground).toMatch(/^#[A-F0-9]{6}$/);
    const terminal = JSON.parse(exportTerminal(p));
    expect(terminal).toHaveProperty("brightPurple");
    expect(terminal).toHaveProperty("selectionBackground");
    expect(exportSvg(p)).toContain('fill="#123456"');
  });
  it("includes off-grid anchor t and exports separate scene selectors", () => {
    const p = project();
    p.studio.anchors[0].t = 0.3;
    p.studio.anchors[0].positionLocked = true;
    expect(exportColormap(p)).toContain("0.3000000000000000,#123456,s1");
    p.sequence = [1, 2].map(i => ({ id: `scene${i}`, name: `scene${i}`,
      studio: p.studio, swatches: p.swatches, roleSets: p.roleSets }));
    expect(exportSequence(p)).toContain(".colors-scene-1");
    expect(exportSequence(p)).toContain(".colors-scene-2");
  });
  it("emits a full 33³ float cube with red fastest and neutral identity reference", () => {
    const p = project();
    p.studio = { ...p.studio, shadow: 0, highlight: 1, contrast: 1, warm: 0, tint: 0 };
    const cube = exportCube(p);
    expect(cube).toContain("LUT_3D_SIZE 33");
    const rows = cube.split("\n").filter(line => /^\d/.test(line)).map(row => row.split(" ").map(Number));
    expect(rows).toHaveLength(35937);
    expect(rows.every(row => row.length === 3 && row.every(c => Number.isFinite(c) && c >= 0 && c <= 1))).toBe(true);
    for (const index of [0, 1, 32, 33, 1089, 35936]) {
      expect(rows[index][0]).toBeCloseTo(index % 33 / 32, 5);
      expect(rows[index][1]).toBeCloseTo(Math.floor(index / 33) % 33 / 32, 5);
      expect(rows[index][2]).toBeCloseTo(Math.floor(index / 1089) / 32, 5);
    }
  });
});
