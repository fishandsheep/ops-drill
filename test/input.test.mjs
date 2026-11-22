import assert from "node:assert/strict";
import test from "node:test";
import { createLineTracker, normalizeCommand } from "../src/course-logic.js";

function trackerWithLog() {
  const log = [];
  const tracker = createLineTracker((entry) => log.push(entry));
  return { tracker, log };
}

test("normalizes whitespace", () => {
  assert.equal(normalizeCommand("  echo   hi  "), "echo hi");
});

test("tracks typing and backspace", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("pwx\x7fd\r");
  assert.deepEqual(log, [{ raw: "pwd", command: "pwd", dirty: false }]);
});

test("ignores the prompt's device-status reply", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("\x1b[1;1R");
  tracker.feed("systemctl status nginx\r");
  assert.deepEqual(log, [
    { raw: "systemctl status nginx", command: "systemctl status nginx", dirty: false },
  ]);
});

test("marks history and completion as dirty", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("pw\x1b[Dd\r");
  assert.equal(log[0].command, "pwd");
  assert.equal(log[0].dirty, true);

  const second = trackerWithLog();
  second.tracker.feed("mk\tlab\r");
  assert.equal(second.log[0].dirty, true);
});

test("handles ctrl-c, ctrl-u and ctrl-w", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("wrong\x03pwd\r");
  tracker.feed("junk\x15pwd\r");
  tracker.feed("echo hello xxx\x17world\r");
  assert.deepEqual(
    log.map((entry) => entry.command),
    ["pwd", "pwd", "echo hello world"]
  );
});

test("unwraps a bracketed paste and submits its newline", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("\x1b[200~du -sh /var/log/*\r\x1b[201~");
  assert.deepEqual(log, [
    { raw: "du -sh /var/log/*", command: "du -sh /var/log/*", dirty: false },
  ]);
});
