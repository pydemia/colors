import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

// Read the fixed implementation-a snapshot. Do not execute the mutable checkout.
const input = 'C:/Users/pydemia/AppData/Local/Temp/colors-implementation-a/src/lib';
const output = await mkdtemp(join(tmpdir(), 'colors-review-release-'));
const culori = import.meta.resolve('culori');
for (const name of ['color', 'studio', 'project', 'exports']) {
  const ts = await readFile(join(input, `${name}.ts`), 'utf8');
  const js = stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"')
    .replaceAll('from "culori"', `from ${JSON.stringify(culori)}`);
  await writeFile(join(output, `${name}.mjs`), js);
}
const { createAnchor, defaultStudio, recommend } = await import(pathToFileURL(join(output, 'studio.mjs')));
const { createProject, parseProject, exportProject, saveProject, loadProjects, STORAGE_KEY } =
  await import(pathToFileURL(join(output, 'project.mjs')));
const exportFns = await import(pathToFileURL(join(output, 'exports.mjs')));

function fixture() {
  const studio = defaultStudio([createAnchor('#336699', 0), createAnchor('#E05566', 1, 2)]);
  return createProject({ kind: 'baseColor', hex: '#336699', harmony: 'analogous', generationIndex: 0 }, recommend(studio)[0].colors, studio);
}
const p = fixture();
p.sequence = [{ id: 'missing-required-scene-fields', name: 'incomplete' }];
try {
  const restored = parseProject(exportProject(p));
  console.log('missingSceneFields.parseAccepted=' + true);
  console.log('missingSceneFields.keys=' + Object.keys(restored.sequence[0]).join(','));
  try { restored.sequence[0].swatches.map(s => s.hex); }
  catch (e) { console.log('missingSceneFields.renderExpressionError=' + e.message); }
} catch (e) { console.log('missingSceneFields.parseRejected=' + e.message); }

// Loading one malformed project blocks the whole list and all normal saves.
const items = new Map();
const storage = {
  getItem: key => items.get(key) ?? null,
  setItem: (key, value) => items.set(key, value),
};
const valid = fixture();
items.set(STORAGE_KEY, JSON.stringify([valid, { schemaVersion: 99 }]));
for (const [name, run] of [['load', () => loadProjects(storage)], ['save', () => saveProject(valid, storage)]]) {
  try { run(); console.log('mixedStore.' + name + '=success'); }
  catch (e) { console.log('mixedStore.' + name + '=failed:' + e.message); }
}
console.log('mixedStore.backupCreated=' + items.has('colors.projects.v1.backup'));

// A fresh schema1 store becomes schema2 on delete without retaining the pre-migration backup.
const { deleteProject } = await import(pathToFileURL(join(output, 'project.mjs')));
const legacyText = await readFile('C:/Users/pydemia/git/colors/.worknotes/examples/locked-base-color.json', 'utf8');
const legacy = JSON.parse(legacyText);
const legacy2 = { ...legacy, projectId: legacy.projectId + '-second' };
items.clear();
items.set(STORAGE_KEY, JSON.stringify([legacy, legacy2]));
deleteProject(legacy.projectId, storage);
console.log('deleteMigration.schema=' + JSON.parse(items.get(STORAGE_KEY))[0].schemaVersion);
console.log('deleteMigration.backupCreated=' + items.has('colors.projects.v1.backup'));

// Check distinct current role values through every role-oriented exporter.
const { setRoleOverride, exportCss } = await import(pathToFileURL(join(output, 'project.mjs')));
let changed = fixture();
for (const [set, role, hex] of [['web', 'primary', '#123456'], ['powerPoint', 'accent1', '#234567'],
  ['editor', 'comment', '#345678'], ['terminal', 'magenta', '#456789']])
  changed = setRoleOverride(changed, set, role, hex);
console.log('currentRoleExports=' + JSON.stringify({
  css: exportCss(changed).includes('--colors-web-primary: #123456;'),
  tokens: JSON.parse(exportFns.exportTokens(changed)).web.primary.$value.hex === '#123456',
  tailwind: exportFns.exportTailwind(changed, 4).includes('--color-colors-primary: #123456;'),
  office: exportFns.exportOffice(changed).includes('<a:accent1><a:srgbClr val="234567"/>'),
  vscode: JSON.parse(exportFns.exportVsCode(changed)).tokenColors.find(t => t.scope === 'comment').settings.foreground === '#345678',
  terminal: JSON.parse(exportFns.exportTerminal(changed)).purple === '#456789',
}));
