// Settings → Progress: export to a file or a code, import from either.
// The format and all validation live in progress-io.js.

import {
  serialize,
  progressFileName,
  parseProgress,
  encodeCode,
  decodeCode,
  describeProgress,
  ImportError,
} from "./progress-io.js";

const MAX_FILE_BYTES = 1_000_000;

export function setProgressStatus(text, kind = "") {
  const status = document.getElementById("progress-status");
  status.textContent = text;
  status.className = `progress-status ${kind}`;
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Wire up the file picker and return the data-action handlers for the
 * Progress section of the settings screen.
 */
export function setupProgressTransfer(getGame) {
  const replaceWith = (learner, source) => {
    const game = getGame();
    const ok = confirm(
      `Replace your current progress (${describeProgress(game.learner)})\nwith the imported progress (${describeProgress(learner)})?`
    );
    if (!ok) {
      setProgressStatus("Import cancelled. Nothing changed.");
      return;
    }
    game.replaceLearner(learner);
    setProgressStatus(`Imported from ${source}: ${describeProgress(learner)}.`, "ok");
  };

  const failed = (error) => {
    if (error instanceof ImportError) {
      setProgressStatus(error.message, "error");
    } else {
      console.error(error);
      setProgressStatus("Something went wrong while importing. Nothing changed.", "error");
    }
  };

  const picker = document.getElementById("import-file");
  picker.addEventListener("change", async () => {
    const [file] = picker.files;
    picker.value = ""; // so picking the same file again still fires "change"
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new ImportError("That file is too big to be a Grep Master progress file.");
      replaceWith(parseProgress(await file.text()), file.name);
    } catch (error) {
      failed(error);
    }
  });

  return {
    "export-file": () => {
      const name = progressFileName();
      download(serialize(getGame().learner), name);
      setProgressStatus(`Saved ${name}.`, "ok");
    },
    "import-file": () => picker.click(),
    "copy-code": async () => {
      const code = await encodeCode(getGame().learner);
      const box = document.getElementById("progress-code");
      box.value = code;
      box.select();
      setProgressStatus("Here's your code, selected in the box above.", "ok");
      // The clipboard can refuse, or (without a real click) never answer, so
      // the code is already on screen and this only improves the message.
      const copied = await Promise.race([
        navigator.clipboard ? navigator.clipboard.writeText(code).then(() => true, () => false) : false,
        new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);
      setProgressStatus(
        copied
          ? "Code copied. On the other device, paste it into this box and press Import code."
          : "Copy the code from the box above (it's selected), then paste it on the other device.",
        "ok"
      );
    },
    "import-code": async () => {
      const code = document.getElementById("progress-code").value;
      if (!code.trim()) {
        setProgressStatus("Paste a progress code into the box first.", "error");
        return;
      }
      try {
        replaceWith(await decodeCode(code), "code");
      } catch (error) {
        failed(error);
      }
    },
  };
}
