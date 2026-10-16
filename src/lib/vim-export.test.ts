import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { exportVim } from "./exports";
import { getRoleHex, starterProject } from "./project";

const vim = process.platform === "win32"
  ? join(process.env.ProgramFiles ?? "C:/Program Files", "Git/usr/bin/vim.exe")
  : "vim";
const available = spawnSync(vim, ["--version"], { timeout: 3000 }).status === 0;

it.skipIf(!available)("loads the generated color scheme in a clean native Vim", () => {
  const folder = mkdtempSync(join(tmpdir(), "colors-vim-"));
  const theme = join(folder, "colors.vim");
  const script = join(folder, "verify.vim");
  const result = join(folder, "result.txt");
  const p = starterProject();
  const literal = (value: string) => value.replace(/\\/g, "/").replace(/'/g, "''");
  try {
    writeFileSync(theme, exportVim(p));
    writeFileSync(script, [
      `execute 'source ' . fnameescape('${literal(theme)}')`,
      `call writefile([g:colors_name, synIDattr(hlID('Normal'), 'fg#', 'gui'), synIDattr(hlID('Normal'), 'bg#', 'gui')], '${literal(result)}')`,
      "qa!",
    ].join("\n"));
    const run = spawnSync(vim, ["-Nu", "NONE", "-i", "NONE", "--noplugin", "-n", "-es", "-V1", "-S", script.replace(/\\/g, "/")],
      { encoding: "utf8", timeout: 5000 });
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(result, "utf8").trim().toLowerCase().split(/\r?\n/)).toEqual([
      "colors", getRoleHex(p, "editor", "foreground").toLowerCase(),
      getRoleHex(p, "editor", "background").toLowerCase(),
    ]);
  } finally {
    for (const file of [theme, script, result]) if (existsSync(file)) unlinkSync(file);
    rmdirSync(folder);
  }
});
