import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const input = 'C:/Users/pydemia/AppData/Local/Temp/colors-implementation-b/src/lib';
const output = await mkdtemp(join(tmpdir(), 'colors-review-release-b-'));
const culori = import.meta.resolve('culori');
for (const name of ['color', 'studio', 'project']) {
  const ts = await readFile(join(input, `${name}.ts`), 'utf8');
  const js = stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"')
    .replaceAll('from "culori"', `from ${JSON.stringify(culori)}`);
  await writeFile(join(output, `${name}.mjs`), js);
}
const { createAnchor, defaultStudio, recommend, coordinateModes } = await import(pathToFileURL(join(output, 'studio.mjs')));
const { createProject, parseProject, exportProject, saveProject, loadProjects, deleteProject, STORAGE_KEY } =
  await import(pathToFileURL(join(output, 'project.mjs')));
function fixture() {
  const studio = defaultStudio([createAnchor('#336699', 0), createAnchor('#E05566', 1, 2)]);
  return createProject({ kind: 'baseColor', hex: '#336699', harmony: 'analogous', generationIndex: 0 }, recommend(studio)[0].colors, studio);
}
function scene(p) {
  return { id: 'scene1', name: 'first', swatches: structuredClone(p.swatches), roleSets: structuredClone(p.roleSets), studio: structuredClone(p.studio) };
}
function memory(throwBackup = false) {
  const data = new Map();
  return { data, storage: { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { if (throwBackup && key === 'colors.projects.v1.backup') throw new Error('quota'); data.set(key, value); } } };
}
for (const field of ['swatches', 'roleSets', 'studio']) {
  const p = fixture(); const s = scene(p); delete s[field]; p.sequence = [s];
  assert.throws(() => parseProject(exportProject(p)), /장면/);
}
const broken = fixture(); broken.sequence = [scene(broken)]; broken.sequence[0].roleSets.web.text.swatchId = 'missing';
assert.throws(() => parseProject(exportProject(broken)), /역할 참조/);
const normalized = fixture(); normalized.sequence = [scene(normalized)];
normalized.sequence[0].swatches[1].hex = '#e05566';
normalized.sequence[0].studio.anchors[1].originalHex = '#e05566';
normalized.sequence[0].roleSets.web.primary.overrideHex = '#abcdef';
normalized.sequence[0].roleSets.web.primary.reason = 'userEdit';
const restored = parseProject(exportProject(normalized));
assert.equal(restored.sequence[0].swatches[1].hex, '#E05566');
assert.equal(restored.sequence[0].studio.anchors[1].originalHex, '#E05566');
assert.equal(restored.sequence[0].roleSets.web.primary.overrideHex, '#ABCDEF');
console.log('O1: missing scene fields/references rejected; scene color, anchor and role normalization preserved');

const legacy = JSON.parse(await readFile('C:/Users/pydemia/git/colors/.worknotes/examples/locked-base-color.json', 'utf8'));
const original = JSON.stringify([legacy, { ...legacy, projectId: legacy.projectId + '-second' }]);
const a = memory(); a.data.set(STORAGE_KEY, original); deleteProject(legacy.projectId, a.storage);
assert.equal(a.data.get('colors.projects.v1.backup'), original);
assert.equal(JSON.parse(a.data.get(STORAGE_KEY)).length, 1);
assert.equal(JSON.parse(a.data.get(STORAGE_KEY))[0].schemaVersion, 2);
const b = memory(true); b.data.set(STORAGE_KEY, original);
assert.throws(() => deleteProject(legacy.projectId, b.storage), /quota/);
assert.equal(b.data.get(STORAGE_KEY), original);
console.log('O2: deletion migration backs up raw v1; failed backup leaves original storage untouched');

for (const mode of coordinateModes) {
  const p = fixture(); p.studio.editingSpace = mode;
  const fromJson = parseProject(exportProject(p));
  const store = memory(); saveProject(p, store.storage);
  const fromStorage = loadProjects(store.storage)[0];
  assert.equal(fromJson.studio.editingSpace, mode);
  assert.equal(fromStorage.studio.editingSpace, mode);
  assert.deepEqual(fromStorage.swatches, p.swatches);
}
const older = fixture(); delete older.studio.editingSpace;
assert.equal(parseProject(exportProject(older)).studio.editingSpace, 'oklch');
assert.equal(parseProject(JSON.stringify(legacy)).studio.editingSpace, 'oklch');
console.log('O4: all 7 editing spaces survive JSON/storage; older schema2 and schema1 default to OKLCH');
