// Progress import/export - move a learner's progress between browsers as a
// JSON file or a short text code. Pure (no DOM).
//
// Imported data is never trusted: every field is checked and clamped, and
// anything unknown is dropped, so a corrupt or hand-edited file can't break
// the game.

import { SKILLS, SKILL_BY_ID } from "./skills.js";
import { newLearner, masteredCount, REVIEW_DAYS } from "./learner.js";
import { SCENARIO_BY_ID } from "./incidents.js";

const APP = "grep-master";
const FORMAT = 1;
const CODE_PREFIX = "GM1:"; // deflate-compressed
const PLAIN_CODE_PREFIX = "GM1p:"; // uncompressed, if CompressionStream isn't available

export class ImportError extends Error {}

// ---------- Export ----------

export function exportProgress(learner, now = Date.now()) {
  return { app: APP, format: FORMAT, exportedAt: new Date(now).toISOString(), learner };
}

export function progressFileName(now = Date.now()) {
  return `grep-master-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export function serialize(learner, now = Date.now()) {
  return JSON.stringify(exportProgress(learner, now), null, 2);
}

// ---------- Import ----------

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const int = (v, min, max, fallback = min) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback);
const time = (v) => (Number.isFinite(v) && v > 0 ? v : null);

function cleanSkills(skills) {
  const out = {};
  if (!isObject(skills)) return out;
  for (const [id, s] of Object.entries(skills)) {
    if (!SKILL_BY_ID[id] || !isObject(s)) continue;
    out[id] = {
      mastery: Number.isFinite(s.mastery) ? Math.min(1, Math.max(0, s.mastery)) : 0,
      attempts: int(s.attempts, 0, 1e6),
      fails: int(s.fails, 0, 1e6),
      step: int(s.step, 0, REVIEW_DAYS.length - 1),
      due: time(s.due),
      lastSeen: time(s.lastSeen),
    };
  }
  return out;
}

function cleanCounts(counts, keep, max) {
  const out = {};
  if (!isObject(counts)) return out;
  for (const [key, value] of Object.entries(counts)) {
    if (keep(key) && Number.isFinite(value)) out[key] = int(value, 0, max);
  }
  return out;
}

/** Turn an untrusted learner object into a valid one. */
export function cleanLearner(raw) {
  const learner = newLearner();
  if (!isObject(raw)) return learner;
  learner.skills = cleanSkills(raw.skills);
  if (isObject(raw.course)) {
    learner.course.index = int(raw.course.index, 0, 1000);
    learner.course.solved = cleanCounts(raw.course.solved, (k) => /^\d+$/.test(k), 100);
  }
  if (isObject(raw.practice)) {
    learner.practice.solved = int(raw.practice.solved, 0, 1e9);
    learner.practice.points = int(raw.practice.points, 0, 1e9);
  }
  learner.mistakes = cleanCounts(raw.mistakes, (k) => /^[a-z-]{1,40}$/.test(k), 1e6);
  learner.placementDone = raw.placementDone === true;
  if (isObject(raw.incidents)) {
    for (const [id, record] of Object.entries(raw.incidents)) {
      if (!SCENARIO_BY_ID[id] || !isObject(record)) continue;
      learner.incidents[id] = { completed: int(record.completed, 0, 1e6), best: int(record.best, 0, 1e6) };
    }
  }
  return learner;
}

/** Read an exported file's text. Throws ImportError with a friendly message. */
export function parseProgress(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("That isn't a Grep Master progress file (it isn't valid JSON).");
  }
  if (!isObject(data) || data.app !== APP || !isObject(data.learner)) {
    throw new ImportError("That isn't a Grep Master progress file.");
  }
  if (!Number.isFinite(data.format) || data.format > FORMAT) {
    throw new ImportError("That progress was saved by a newer version of Grep Master. Reload the page and try again.");
  }
  return cleanLearner(data.learner);
}

// ---------- Codes ----------

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function transform(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** A copyable text code for the learner's progress. */
export async function encodeCode(learner, now = Date.now()) {
  const bytes = new TextEncoder().encode(JSON.stringify(exportProgress(learner, now)));
  if (typeof CompressionStream === "undefined") return PLAIN_CODE_PREFIX + toBase64Url(bytes);
  return CODE_PREFIX + toBase64Url(await transform(bytes, new CompressionStream("deflate-raw")));
}

/** Read a pasted code. Throws ImportError with a friendly message. */
export async function decodeCode(code) {
  const text = String(code).replace(/\s+/g, "");
  const compressed = text.startsWith(CODE_PREFIX);
  if (!compressed && !text.startsWith(PLAIN_CODE_PREFIX)) {
    throw new ImportError("That isn't a Grep Master progress code. Codes start with GM1.");
  }
  let bytes;
  try {
    bytes = fromBase64Url(text.slice(compressed ? CODE_PREFIX.length : PLAIN_CODE_PREFIX.length));
    if (compressed) bytes = await transform(bytes, new DecompressionStream("deflate-raw"));
  } catch {
    throw new ImportError("That progress code is damaged. Copy the whole code and try again.");
  }
  return parseProgress(new TextDecoder().decode(bytes));
}

// ---------- Summaries ----------

/** One line describing some progress, for confirmations: "12/22 skills mastered, ...". */
export function describeProgress(learner) {
  const course = Object.keys(learner.course.solved).length;
  const points = Object.values(learner.course.solved).reduce((a, b) => a + b, 0) + learner.practice.points;
  const incidents = Object.keys(learner.incidents).length;
  const parts = [`${masteredCount(learner)}/${SKILLS.length} skills mastered`];
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (course) parts.push(plural(course, "course challenge"));
  if (incidents) parts.push(plural(incidents, "incident"));
  parts.push(`${points} points`);
  return parts.join(", ");
}
