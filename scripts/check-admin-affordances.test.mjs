/**
 * check-admin-affordances.mjs, read against fixtures: each of the four
 * shapes is found, the house's real buttons and links are not, a waiver
 * holds, and report mode exits 0 whatever it finds.
 *
 * Run: node scripts/check-admin-affordances.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { drawnAsText, scanSource } from "./check-admin-affordances.mjs";

const rules = (src) => scanSource("Fixture.tsx", src).map((f) => f.rule);

// Found.
assert.deepStrictEqual(rules(`export const A = () => <div onClick={go}>Open</div>;`), ["clickable-non-control"]);
assert.deepStrictEqual(rules(`export const A = () => <button type="button" onClick={stop} className="text-red-700 underline">Stop</button>;`), ["button-drawn-as-text"]);
assert.deepStrictEqual(rules(`export const A = () => <button type="button" onClick={go} className="text-xs text-gray-400 hover:text-red-600">Deactivate</button>;`), ["button-drawn-as-text"]);
assert.deepStrictEqual(rules(`export const A = () => <a onClick={remove}>Remove</a>;`), ["link-used-as-action"]);
assert.deepStrictEqual(rules(`export const A = () => <a href="#" onClick={remove}>Remove</a>;`), ["link-used-as-action"]);
assert.deepStrictEqual(rules(`export const A = () => <button onClick={remove} className="p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>;`), ["unnamed-icon-button"]);

// Not found: real buttons, real links, named icon buttons, text from code.
assert.deepStrictEqual(rules(`export const A = () => <button type="button" className="rounded-lg border border-border px-4 text-sm">Change</button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button type="button" className="rounded-xl bg-notice px-5 text-background">Save</button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button type="button" className={primaryCls}>Send me a test</button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button aria-label="Delete this question" onClick={remove}><Trash2 className="w-4 h-4" /></button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button onClick={go}><OpenLabel label={name} /></button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button onClick={go}>{busy ? "Saving" : "Save"}</button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <a href="/admin?tab=players" onClick={track}>Players</a>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <button role="menuitem" className="w-full text-left text-sm text-foreground">Sign out</button>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <label onClick={pick}>Pick</label>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <li role="option" aria-selected={on} onClick={pick}>Mail settings</li>;`), []);
assert.deepStrictEqual(rules(`export const A = () => <li onClick={pick}>Mail settings</li>;`), ["clickable-non-control"]);

// A waiver on the line above holds.
assert.deepStrictEqual(rules(`export const A = () => (\n  // affordance-ok: a row of a list the whole row of which is the target\n  <div onClick={go}>Open</div>\n);`), []);

// Classes partly from code are judged only on an underline.
assert.strictEqual(drawnAsText("mt-3", true), false);
assert.strictEqual(drawnAsText("mt-3 underline", true), true);

// Report mode: findings printed, exit 0.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "affordances-"));
fs.mkdirSync(path.join(root, "client/src/components/admin"), { recursive: true });
fs.writeFileSync(path.join(root, "client/src/components/admin/Bad.tsx"), `export const A = () => <div onClick={go}>Open</div>;\n`);
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-admin-affordances.mjs");
const r = spawnSync(process.execPath, [SCRIPT, "--report", "--root", root], { encoding: "utf8" });
assert.strictEqual(r.status, 0, r.stdout + r.stderr);
assert.match(r.stdout, /1 finding\(s\) in 1 file\(s\)/);
assert.match(r.stdout, /Bad\.tsx:1 {2}clickable-non-control/);

console.log("check-admin-affordances: all fixture checks pass");
