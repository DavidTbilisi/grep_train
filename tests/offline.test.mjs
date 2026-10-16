// The service worker must cache every file the game loads, or offline play
// breaks the first time a new module is added without updating sw.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const sw = read("sw.js");
const precache = JSON.parse(
  sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]")
);

test("every game file is precached", () => {
  const scripts = readdirSync(new URL("js/", root)).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);
  const html = read("index.html");
  const linked = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const file of ["./", "index.html", ...scripts, ...linked]) {
    assert.ok(precache.includes(file), `${file} is missing from PRECACHE in sw.js`);
  }
});

test("every precached file exists", () => {
  for (const file of precache.filter((f) => f !== "./")) {
    assert.ok(existsSync(new URL(file, root)), `${file} is in PRECACHE but doesn't exist`);
  }
});

test("the manifest is valid and its icons exist", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) assert.ok(existsSync(new URL(icon.src, root)), icon.src);
});
