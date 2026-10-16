import { converter } from "culori";
import { exportCss, getRoleHex, roleKeys, type Project } from "./project";
import { lookColor, mapStops, sampleMap } from "./studio";
import { luminance } from "./color";

const rgb = converter("rgb");
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const kebab = (name: string) => name.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`);
const ansiRoles = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue",
  "brightMagenta", "brightCyan", "brightWhite",
] as const;

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
    ...Object.fromEntries(ansiRoles.map(role => [role.replace("magenta", "purple")
        .replace("Magenta", "Purple"), c(role)])) });
}

export function exportVsCodeSettings(project: Project): string {
  const theme = JSON.parse(exportVsCode(project));
  return json({
    "workbench.colorCustomizations": theme.colors,
    "editor.tokenColorCustomizations": { textMateRules: theme.tokenColors },
  });
}

export function exportJetBrains(project: Project): string {
  const c = (role: string) => getRoleHex(project, "editor", role).slice(1);
  const parent = luminance(getRoleHex(project, "editor", "background")) < 0.5
    ? "Darcula" : "Default";
  const attributes: [string, string][] = [
    ["DEFAULT_LINE_COMMENT", "comment"], ["DEFAULT_BLOCK_COMMENT", "comment"],
    ["DEFAULT_DOC_COMMENT", "comment"], ["DEFAULT_KEYWORD", "keyword"],
    ["DEFAULT_STRING", "string"], ["DEFAULT_NUMBER", "number"],
    ["DEFAULT_CLASS_NAME", "type"], ["DEFAULT_INTERFACE_NAME", "type"],
    ["DEFAULT_FUNCTION_DECLARATION", "function"],
    ["DEFAULT_FUNCTION_CALL", "function"], ["DEFAULT_IDENTIFIER", "variable"],
    ["DEFAULT_LOCAL_VARIABLE", "variable"], ["DEFAULT_PARAMETER", "variable"],
  ];
  const colors: [string, string][] = [
    ["CARET_COLOR", "foreground"], ["SELECTION_BACKGROUND", "selection"],
    ["SELECTION_FOREGROUND", "foreground"], ["CONSOLE_BACKGROUND_KEY", "background"],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<scheme name="Colors" version="142" parent_scheme="${parent}">\n` +
    `  <colors>\n${colors.map(([key, role]) =>
      `    <option name="${key}" value="${c(role)}" />`).join("\n")}\n  </colors>\n` +
    `  <attributes>\n    <option name="TEXT"><value>` +
    `<option name="FOREGROUND" value="${c("foreground")}" />` +
    `<option name="BACKGROUND" value="${c("background")}" />` +
    `</value></option>\n` + attributes.map(([key, role]) =>
      `    <option name="${key}"><value><option name="FOREGROUND" value="${c(role)}" /></value></option>`
    ).join("\n") + "\n  </attributes>\n</scheme>\n";
}

/** GUI/true-color Vim colors; cterm uses the nearest fixed xterm-256 color. */
export function exportVim(project: Project): string {
  const c = (role: string) => getRoleHex(project, "editor", role);
  const xterm = Array.from({ length: 240 }, (_, index) => {
    const i = index + 16;
    if (i >= 232) return [8 + (i - 232) * 10, 8 + (i - 232) * 10, 8 + (i - 232) * 10];
    const n = i - 16;
    const levels = [0, 95, 135, 175, 215, 255];
    return [levels[Math.floor(n / 36)], levels[Math.floor(n / 6) % 6], levels[n % 6]];
  });
  const nearest = (hex: string) => {
    const value = rgb(hex)!;
    const channels = [value.r * 255, value.g * 255, value.b * 255];
    let best = 0;
    let distance = Infinity;
    xterm.forEach((candidate, i) => {
      const delta = candidate.reduce((sum, v, k) => sum + (v - channels[k]) ** 2, 0);
      if (delta < distance) { best = i; distance = delta; }
    });
    return best + 16;
  };
  const highlight = (group: string, foreground: string, background?: string) =>
    `highlight ${group} guifg=${foreground} guibg=${background ?? "NONE"} gui=NONE ` +
    `ctermfg=${nearest(foreground)} ctermbg=${background ? nearest(background) : "NONE"} cterm=NONE`;
  return [
    '" Colors generated color scheme. True color preserves HEX; xterm-256 is approximate.',
    `set background=${luminance(c("background")) < 0.5 ? "dark" : "light"}`,
    "highlight clear", 'if exists("syntax_on")', "  syntax reset", "endif",
    'let g:colors_name = "colors"',
    highlight("Normal", c("foreground"), c("background")),
    highlight("Visual", c("foreground"), c("selection")),
    ...Object.entries({ Comment: "comment", Constant: "number", Number: "number",
      String: "string", Statement: "keyword", Keyword: "keyword", Type: "type",
      Function: "function", Identifier: "variable", Error: "error", WarningMsg: "warning" })
      .map(([group, role]) => highlight(group, c(role))),
    "",
  ].join("\n");
}

export function exportITerm(project: Project): string {
  const entries = [
    ...ansiRoles.map((role, i) => [`Ansi ${i} Color`, role]),
    ["Background Color", "background"], ["Foreground Color", "foreground"],
    ["Cursor Color", "cursor"], ["Cursor Text Color", "background"],
    ["Selection Color", "selection"], ["Selected Text Color", "foreground"],
    ["Bold Color", "brightWhite"],
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0"><dict>\n' + entries.map(([key, role]) => {
      const value = rgb(getRoleHex(project, "terminal", role))!;
      return `  <key>${key}</key><dict><key>Color Space</key><string>sRGB</string>` +
        "<key>Alpha Component</key><real>1</real>" +
        ["Red", "Green", "Blue"].map((name, i) =>
          `<key>${name} Component</key><real>${[value.r, value.g, value.b][i]}</real>`).join("") +
        "</dict>";
    }).join("\n") + "\n</dict></plist>\n";
}

/** Windows .reg uses UTF-16LE with BOM; only the Colors session's colors are set. */
export function exportPutty(project: Project): Uint8Array<ArrayBuffer> {
  const colors = ["foreground", "brightWhite", "background", "background",
    "background", "cursor", ...ansiRoles.slice(0, 8).flatMap((role, i) =>
      [role, ansiRoles[i + 8]])];
  const text = ["Windows Registry Editor Version 5.00", "",
    "[HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\Colors]",
    ...colors.map((role, i) => {
      const value = rgb(getRoleHex(project, "terminal", role))!;
      return `"Colour${i}"="${[value.r, value.g, value.b].map(v => Math.round(v * 255)).join(",")}"`;
    }), "", ""].join("\r\n");
  const bytes = new Uint8Array(new ArrayBuffer(2 + text.length * 2));
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0xfeff, true);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  return bytes;
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
