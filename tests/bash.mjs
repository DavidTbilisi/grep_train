// Run commands with real bash + GNU tools (LC_ALL=C) against a virtual file set.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runBash(files, commands) {
  const dir = mkdtempSync(join(tmpdir(), "grep-master-test-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return commands.map((cmd) => {
      // grep exits 1 when nothing matches, so read stdout regardless of status.
      const out = spawnSync("bash", ["-c", cmd], { cwd: dir, env: { ...process.env, LC_ALL: "C" }, encoding: "utf8" }).stdout;
      return out === "" ? [] : out.replace(/\n$/, "").split("\n");
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
}

export const normalizeSpaces = (lines) => lines.map((l) => l.trim().replace(/\s+/g, " "));
