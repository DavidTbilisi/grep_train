// Tab completion for the in-game grep prompt (bash-style: Tab completes / cycles).

const COMMAND = "grep";

const GREP_FLAGS = [
  "-A",
  "-B",
  "-C",
  "-c",
  "-E",
  "-H",
  "-i",
  "-n",
  "-o",
  "-r",
  "-v",
  "-w",
];

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

    const start = i;
    while (i < len && !/\s/.test(prefix[i])) i++;
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
  const m = before.match(/(\S*)$/);
  const word = m ? m[1] : "";
  const wordStart = cursor - word.length;
  return { word, wordStart };
}

function classifyCompletion(value, cursor) {
  const { word, wordStart } = getWordAtCursor(value, cursor);
  const prefix = value.slice(0, wordStart);
  const tokens = shellTokenizePrefix(prefix);

  if (inIncompleteQuotedWord(word)) {
    return { kind: "none", word, wordStart };
  }

  if (tokens.length === 0) {
    if (COMMAND.startsWith(word) && word.length < COMMAND.length) {
      return { kind: "command", word, wordStart };
    }
    return { kind: "none", word, wordStart };
  }

  if (tokens[0] !== COMMAND) {
    if (tokens.length === 1 && COMMAND.startsWith(word) && word.length < COMMAND.length) {
      return { kind: "command", word, wordStart };
    }
    return { kind: "none", word, wordStart };
  }

  const afterGrep = tokens.slice(1);
  let i = 0;
  while (i < afterGrep.length && afterGrep[i].startsWith("-")) {
    i++;
  }
  const rest = afterGrep.slice(i);

  if (word.startsWith("-")) {
    return { kind: "flag", word, wordStart };
  }

  if (rest.length >= 2) {
    return { kind: "file", word, wordStart };
  }

  if (rest.length === 1) {
    if (word === "") {
      return { kind: "file", word, wordStart };
    }
    if (word !== rest[0]) {
      return { kind: "file", word, wordStart };
    }
  }

  return { kind: "none", word, wordStart };
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
    const { kind, word, wordStart } = classifyCompletion(value, cursor);

    let candidates = [];
    if (kind === "command") {
      candidates = [COMMAND];
    } else if (kind === "flag") {
      candidates = filterPrefix(GREP_FLAGS, word);
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
