import { converter } from "culori";
import { exportCss, getRoleHex, roleKeys, type Project } from "./project";
import { lookColor, mapStops, sampleMap } from "./studio";

const rgb = converter("rgb");
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const kebab = (name: string) => name.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`);

export function exportTokens(project: Project): string {
  const token = (hex: string) => {
    const c = rgb(hex)!;
    return { $type: "color", $value: { colorSpace: "srgb",
      components: [c.r, c.g, c.b], alpha: 1, hex } };
  };
  return json({ palette: Object.fromEntries(project.swatches.map(s => [s.id, token(s.hex)])),
    ...Object.fromEntries(Object.entries(roleKeys).map(([set, keys]) => [set,
      Object.fromEntries(keys.map(role => [role, token(getRoleHex(project,
        set as keyof typeof roleKeys, role))]))])) });
}
export function exportTailwind(project: Project, version: 3 | 4): string {
  const colors = Object.fromEntries(roleKeys.web.map(role =>
    [kebab(role), getRoleHex(project, "web", role)]));
  return version === 3 ? `module.exports = ${json({ theme: { extend: { colors: { colors } } } })};\n`
    : `@theme {\n${Object.entries(colors).map(([key, hex]) =>
      `  --color-colors-${key}: ${hex};`).join("\n")}\n}\n`;
}
export function exportSvg(project: Project): string {
  const width = project.swatches.length * 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="144" viewBox="0 0 ${width} 144">\n` +
    project.swatches.map((s, i) => `<rect x="${i * 120}" width="120" height="100" fill="${s.hex}"/>` +
      `<text x="${i * 120 + 10}" y="125" font-family="monospace" font-size="14">${s.hex}</text>`).join("\n") +
    "\n</svg>\n";
}
export function exportAse(project: Project): Uint8Array<ArrayBuffer> {
  const blocks = project.swatches.map(s => {
    const name = `${s.id} ${s.hex}`;
    const length = 2 + (name.length + 1) * 2 + 4 + 12 + 2;
    const buffer = new ArrayBuffer(6 + length);
    const view = new DataView(buffer);
    view.setUint16(0, 1); view.setUint32(2, length);
    view.setUint16(6, name.length + 1);
    let pos = 8;
    for (const ch of name) { view.setUint16(pos, ch.charCodeAt(0)); pos += 2; }
    view.setUint16(pos, 0); pos += 2;
    for (const ch of "RGB ") view.setUint8(pos++, ch.charCodeAt(0));
    const c = rgb(s.hex)!;
    for (const channel of [c.r, c.g, c.b]) { view.setFloat32(pos, channel); pos += 4; }
    view.setUint16(pos, 0);
    return new Uint8Array(buffer);
  });
  const output = new Uint8Array(new ArrayBuffer(12 + blocks.reduce((n, b) => n + b.length, 0)));
  output.set([65, 83, 69, 70]);
  const view = new DataView(output.buffer);
  view.setUint16(4, 1); view.setUint16(6, 0); view.setUint32(8, blocks.length);
  let pos = 12;
  for (const block of blocks) { output.set(block, pos); pos += block.length; }
  return output;
}
export function exportOffice(project: Project): string {
  const slots: Record<string, string> = { dk1: "dark1", lt1: "light1", dk2: "dark2", lt2: "light2",
    ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`accent${i + 1}`, `accent${i + 1}`])),
    hlink: "hyperlink", folHlink: "followedHyperlink" };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<a:clrScheme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Colors">\n` +
    Object.entries(slots).map(([slot, role]) => `  <a:${slot}><a:srgbClr val="${getRoleHex(project, "powerPoint", role).slice(1)}"/></a:${slot}>`).join("\n") +
    "\n</a:clrScheme>\n";
}
export function exportVsCode(project: Project): string {
  const c = (role: string) => getRoleHex(project, "editor", role);
  return json({ name: "Colors", type: project.studio.theme,
    colors: { "editor.background": c("background"), "editor.foreground": c("foreground"),
      "editor.selectionBackground": c("selection"), "editorError.foreground": c("error"),
      "editorWarning.foreground": c("warning") },
    tokenColors: Object.entries({ comment: "comment", keyword: "keyword", string: "string",
      number: "constant.numeric", type: "entity.name.type", function: "entity.name.function",
      variable: "variable" }).map(([role, scope]) => ({ scope,
        settings: { foreground: c(role) } })) });
}
export function exportTerminal(project: Project): string {
  const c = (role: string) => getRoleHex(project, "terminal", role);
  return json({ name: `Colors-${project.projectId.slice(0, 8)}`,
    background: c("background"), foreground: c("foreground"), cursorColor: c("cursor"),
    selectionBackground: c("selection"),
    ...Object.fromEntries(["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
      "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta",
      "brightCyan", "brightWhite"].map(role => [role.replace("magenta", "purple")
        .replace("Magenta", "Purple"), c(role)])) });
}
export function exportColormap(project: Project): string {
  const samples = sampleMap(mapStops(project.studio, project.swatches), project.studio);
  return "t,hex,anchorId\n" + samples.map(s => `${s.t.toPrecision(16)},${s.hex},${s.id}`).join("\n") + "\n";
}
export function exportCube(project: Project): string {
  const rows = ["TITLE \"Colors creative look - display referred sRGB\"",
    "# Input/output: encoded sRGB, D65. Creative OKLab controls, not camera LOG.",
    "# Palette locks apply to palette exports; LUT applies the look to all RGB inputs.",
    "LUT_3D_SIZE 33", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"];
  // .cube order: red changes fastest, then green, then blue.
  for (let b = 0; b < 33; b++) for (let g = 0; g < 33; g++) for (let r = 0; r < 33; r++) {
    const result = rgb(lookColor({ mode: "rgb", r: r / 32,
      g: g / 32, b: b / 32 }, project.studio))!;
    rows.push([result.r, result.g, result.b].map(c => Math.min(1, Math.max(0, c)).toFixed(8)).join(" "));
  }
  return rows.join("\n") + "\n";
}
export function exportSequence(project: Project): string {
  return project.sequence.map((scene, i) =>
    `/* Scene ${i + 1} */\n` + exportCss({ ...project, ...scene })
      .replace(":root", `.colors-scene-${i + 1}`)).join("\n");
}
