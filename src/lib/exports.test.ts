import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { createProject, exportCss, getRoleHex, setRoleOverride } from "./project";
import { createAnchor, defaultStudio, recommend } from "./studio";
import { exportAse, exportColormap, exportCube, exportOffice, exportSequence,
  exportSvg, exportTailwind, exportTerminal, exportTokens, exportVsCode,
  exportVsCodeSettings, exportJetBrains, exportVim, exportITerm, exportPutty } from "./exports";

function project() {
  const s = defaultStudio([createAnchor("#123456", 0), createAnchor("#E05566", 1, 2)]);
  return createProject({ kind: "baseColor", hex: "#123456", harmony: "analogous", generationIndex: 0 }, recommend(s)[0].colors, s);
}
describe("export contracts", () => {
  it("exports exact palette CSS and current overrides in VS Code settings", () => {
    const p = setRoleOverride(setRoleOverride(project(), "web", "primary", "#ABCDEF"),
      "editor", "foreground", "#1A2B3C");
    expect(exportCss(p)).toContain("--colors-palette-s1: #123456;");
    expect(exportCss(p)).toContain("--colors-web-primary: #ABCDEF;");
    const settings = JSON.parse(exportVsCodeSettings(p));
    expect(settings["workbench.colorCustomizations"]["editor.foreground"]).toBe("#1A2B3C");
    expect(settings["editor.tokenColorCustomizations"].textMateRules).toEqual(JSON.parse(exportVsCode(p)).tokenColors);
  });
  it("maps JetBrains generic attributes and actual background to the parent", () => {
    let p = setRoleOverride(project(), "editor", "keyword", "#123ABC");
    p = setRoleOverride(p, "editor", "background", "#101010");
    expect(exportJetBrains(p)).toContain('parent_scheme="Darcula"');
    expect(exportJetBrains(p)).toContain('<option name="DEFAULT_KEYWORD"><value><option name="FOREGROUND" value="123ABC" />');
    p = setRoleOverride(p, "editor", "background", "#FFFFFF");
    expect(exportJetBrains(p)).toContain('parent_scheme="Default"');
    expect(exportJetBrains(p)).toContain('<option name="BACKGROUND" value="FFFFFF" />');
  });
  it("preserves Vim true color and emits bounded xterm-256 indexes", () => {
    const p = setRoleOverride(project(), "editor", "foreground", "#FF0000");
    const text = exportVim(p);
    expect(text).toContain('let g:colors_name = "colors"');
    expect(text).toContain("highlight Normal guifg=#FF0000");
    expect(text).toMatch(/highlight Normal .*ctermfg=196/);
    const indexes = [...text.matchAll(/cterm(?:fg|bg)=(\d+)/g)].map(match => Number(match[1]));
    expect(indexes.every(i => i >= 16 && i <= 255)).toBe(true);
    expect(text).toContain(`highlight Comment guifg=${getRoleHex(p, "editor", "comment")}`);
  });
  it("emits an sRGB iTerm plist with all ANSI colors and terminal overrides", () => {
    const p = setRoleOverride(project(), "terminal", "foreground", "#123456");
    const text = exportITerm(p);
    const entries = [...text.matchAll(/<key>([^<]+)<\/key><dict>(.*?)<\/dict>/g)];
    expect(entries).toHaveLength(23);
    expect(entries.filter(entry => /^Ansi \d+ Color$/.test(entry[1]))).toHaveLength(16);
    const foreground = entries.find(entry => entry[1] === "Foreground Color")![2];
    expect(foreground).toContain("<string>sRGB</string>");
    const values = [...foreground.matchAll(/<real>([^<]+)<\/real>/g)].map(entry => Number(entry[1]));
    expect(values).toEqual([1, 18 / 255, 52 / 255, 86 / 255]);
    expect(text.endsWith("</dict></plist>\n")).toBe(true);
  });
  it("encodes a PuTTY color-only session with UTF-16LE BOM and ANSI pairs", () => {
    let p = setRoleOverride(project(), "terminal", "foreground", "#123456");
    p = setRoleOverride(p, "terminal", "red", "#FF0000");
    p = setRoleOverride(p, "terminal", "brightRed", "#00FF00");
    const bytes = exportPutty(p);
    expect([...bytes.slice(0, 2)]).toEqual([255, 254]);
    const text = new TextDecoder("utf-16le").decode(bytes);
    expect(text.startsWith("Windows Registry Editor Version 5.00\r\n")).toBe(true);
    expect(text).toContain("[HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\Colors]");
    const colors = [...text.matchAll(/"Colour(\d+)"="(\d+,\d+,\d+)"/g)];
    expect(colors).toHaveLength(22);
    expect(colors.map(match => Number(match[1]))).toEqual(Array.from({ length: 22 }, (_, i) => i));
    expect(colors[0][2]).toBe("18,52,86");
    expect(colors[8][2]).toBe("255,0,0");
    expect(colors[9][2]).toBe("0,255,0");
    expect(text.match(/^\[/gm)).toHaveLength(1);
  });
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
