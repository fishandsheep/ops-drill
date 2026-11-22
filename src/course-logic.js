/**
 * Course rules and terminal input tracking, with no UI or kernel imports,
 * so the same logic runs in the page and in tests.
 */

export function normalizeCommand(command) {
  return command.trim().replace(/\s+/g, " ");
}

export function isAccepted(step, command) {
  const normalized = normalizeCommand(command);
  return step.accept.some((candidate) => normalizeCommand(candidate) === normalized);
}

/**
 * Mirrors what the user typed while the real shell echoes and edits it.
 * `onEnter` fires once per Enter with the line, unless the line was
 * changed behind our back by history, arrows, completion, etc. (`dirty`).
 */
export function createLineTracker(onEnter) {
  let line = "";
  let dirty = false;
  let paste = false;

  function reset() {
    line = "";
    dirty = false;
    paste = false;
  }

  function submit() {
    const raw = line;
    const wasDirty = dirty;
    reset();
    onEnter({ raw, command: normalizeCommand(raw), dirty: wasDirty });
  }

  function feed(data) {
    for (let i = 0; i < data.length; i += 1) {
      const ch = data[i];

      if (ch === "\x1b") {
        const rest = data.slice(i);
        const match =
          /^\x1b\[[0-9;?]*[ -/]*[@-~]/.exec(rest) ||
          /^\x1bO[A-Za-z]/.exec(rest) ||
          /^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/.exec(rest);
        if (match) {
          const seq = match[0];
          if (seq === "\x1b[200~") {
            paste = true;
          } else if (seq === "\x1b[201~") {
            paste = false;
          } else if (!paste && !/[Rc]$/.test(seq)) {
            // Arrows, Home/End, Delete: they change the line behind our back.
            // Device reports such as the prompt's DSR reply (CSI 1;1R) do not.
            dirty = true;
          }
          i += seq.length - 1;
          continue;
        }
        dirty = true;
        continue;
      }

      if (ch === "\r" || ch === "\n") {
        submit();
        continue;
      }

      if (paste) {
        line += ch;
        continue;
      }

      if (ch === "\x7f" || ch === "\b") {
        line = line.slice(0, -1);
      } else if (ch === "\x03") {
        reset();
      } else if (ch === "\x15") {
        line = "";
      } else if (ch === "\x17") {
        line = line.replace(/\S+\s*$/, "");
      } else if (ch === "\t") {
        dirty = true;
      } else if (ch >= " ") {
        line += ch;
      }
    }
  }

  return {
    feed,
    reset,
    get line() {
      return line;
    },
    get dirty() {
      return dirty;
    },
  };
}
