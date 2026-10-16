// Tab completion for the in-game prompt (bash-style: Tab completes / cycles).
// Completes command names (also right after a |), each tool's flags, and file names.

import { TOOLS } from "./shell.js";

const COMMANDS = [...Object.keys(TOOLS), "help", "clear"];

function shellTokenizePrefix(prefix) {
  const tokens = [];
  let i = 0;
  const len = prefix.length;

  while (i < len) {
    while (i < len && /\s/.test(prefix[i])) i++;
    if (i >= len) break;

    if (prefix[i] === '"' || prefix[i] === "'") {
      const q = prefix[i];
      const start = i;
      i++;
      while (i < len) {
        if (prefix[i] === "\\" && i + 1 < len) {
          i += 2;
          continue;
        }
        if (prefix[i] === q) {
          i++;
          break;
        }
        i++;
      }
      if (i <= len) tokens.push(prefix.slice(start, i));
      continue;
    }

    if (prefix[i] === "|") {
      tokens.push("|");
      i++;
      continue;
    }

    const start = i;
    while (i < len && !/[\s|]/.test(prefix[i])) i++;
    tokens.push(prefix.slice(start, i));
  }

  return tokens;
}

function inIncompleteQuotedWord(word) {
  if (!word.length) return false;
  const q = word[0];
  if (q !== "'" && q !== '"') return false;
  let escaped = false;
  for (let j = 1; j < word.length; j++) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (word[j] === "\\") {
      escaped = true;
      continue;
    }
    if (word[j] === q) return false;
  }
  return true;
}

function longestCommonPrefix(list) {
  if (!list.length) return "";
  let p = list[0];
  for (let i = 1; i < list.length; i++) {
    const s = list[i];
    let j = 0;
    while (j < p.length && j < s.length && p[j] === s[j]) j++;
    p = p.slice(0, j);
    if (!p) return "";
  }
  return p;
}

function getWordAtCursor(value, cursor) {
  const before = value.slice(0, cursor);
  const m = before.match(/([^\s|]*)$/);
  const word = m ? m[1] : "";
  const wordStart = cursor - word.length;
  return { word, wordStart };
}

function classifyCompletion(value, cursor) {
  const { word, wordStart } = getWordAtCursor(value, cursor);
  if (inIncompleteQuotedWord(word)) {
    return { kind: "none", word, wordStart };
  }

  // Only the current pipeline stage matters: `grep x app.log | so<Tab>`
  const tokens = shellTokenizePrefix(value.slice(0, wordStart));
  const stage = tokens.slice(tokens.lastIndexOf("|") + 1);

  if (stage.length === 0) {
    return { kind: "command", word, wordStart };
  }
  if (word.startsWith("-")) {
    return { kind: "flag", command: stage[0], word, wordStart };
  }
  return { kind: "file", word, wordStart };
}

function filterPrefix(list, prefix) {
  return list.filter((item) => item.startsWith(prefix));
}

function applyCompletion(input, wordStart, cursor, newWord) {
  const v = input.value;
  const next = v.slice(0, wordStart) + newWord + v.slice(cursor);
  const nextCursor = wordStart + newWord.length;
  input.value = next;
  input.setSelectionRange(nextCursor, nextCursor);
}

/**
 * @param {HTMLInputElement} input
 * @param {() => { gameStarted?: boolean, currentFiles?: Record<string, string> } | null | undefined} getGame
 */
export function attachCommandAutocomplete(input, getGame) {
  let cycleKey = "";
  let cycleIndex = 0;

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.isComposing) return;

    const game = getGame();
    const inGame = game && game.gameStarted;
    const gameScreen = document.getElementById("game-screen");
    const active = gameScreen && gameScreen.classList.contains("active");
    if (!inGame || !active) return;

    e.preventDefault();

    const value = input.value;
    const cursor = input.selectionStart ?? value.length;
    const { kind, command, word, wordStart } = classifyCompletion(value, cursor);

    let candidates = [];
    if (kind === "command") {
      candidates = filterPrefix(COMMANDS, word);
    } else if (kind === "flag") {
      candidates = filterPrefix(TOOLS[command]?.flags ?? [], word);
    } else if (kind === "file" && game.currentFiles) {
      candidates = filterPrefix(Object.keys(game.currentFiles), word);
    }

    if (!candidates.length) return;

    const uniq = [...new Set(candidates)].sort();
    const key = `${kind}|${wordStart}|${word}|${uniq.join(",")}`;
    if (key !== cycleKey) {
      cycleKey = key;
      cycleIndex = 0;
    }

    const lcp = longestCommonPrefix(uniq);
    if (uniq.length === 1) {
      applyCompletion(input, wordStart, cursor, uniq[0]);
      cycleKey = "";
      return;
    }

    if (lcp.length > word.length) {
      applyCompletion(input, wordStart, cursor, lcp);
      cycleKey = "";
      return;
    }

    const pick = uniq[cycleIndex % uniq.length];
    cycleIndex++;
    applyCompletion(input, wordStart, cursor, pick);
  });

  input.addEventListener("input", () => {
    cycleKey = "";
  });
}
