import assert from "node:assert/strict";
import test from "node:test";
import { createLineTracker, isAccepted, normalizeCommand } from "../src/course-logic.js";
import { course } from "./typing-drill.lesson.js";

function trackerWithLog() {
  const log = [];
  const tracker = createLineTracker((entry) => log.push(entry));
  return { tracker, log };
}

test("normalizes whitespace", () => {
  assert.equal(normalizeCommand("  echo   hi  "), "echo hi");
});

test("accepts quoted and unquoted echo variants for the write step", () => {
  const step = course.steps[5];
  assert.ok(isAccepted(step, 'echo "hello linux" > notes.txt'));
  assert.ok(isAccepted(step, "echo 'hello linux' > notes.txt"));
  assert.ok(isAccepted(step, "echo  hello   linux > notes.txt"));
  assert.ok(!isAccepted(step, "echo hello > notes.txt"));
});

test("tracks typing and backspace", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("pwx\x7fd\r");
  assert.deepEqual(log, [{ raw: "pwd", command: "pwd", dirty: false }]);
});

test("ignores the prompt's device-status reply", () => {
  const { tracker, log } = trackerWithLog();
  tracker.feed("\x1b[1;1R");
  tracker.feed("pwd\r");
  assert.deepEqual(log, [{ raw: "pwd", command: "pwd", dirty: false }]);
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
  tracker.feed("\x1b[200~cat notes.txt\r\x1b[201~");
  assert.deepEqual(log, [{ raw: "cat notes.txt", command: "cat notes.txt", dirty: false }]);
});

test("the lesson runs on a real Linux kernel", { timeout: 180_000 }, async () => {
  const { createKernel } = await import("unkernel");
  const vm = await createKernel({ memoryMiB: 256 });
  const run = (command, options) => vm.exec("sh", ["-c", command], options);

  try {
    const pwd = await run("pwd");
    assert.equal(pwd.stdout.trim(), "/root");

    assert.equal((await run("ls")).exitCode, 0);
    assert.equal((await run("mkdir lab")).exitCode, 0);

    // The pty shell runs `cd lab`; the checks only look at the result.
    assert.equal((await run("touch notes.txt", { cwd: "/root/lab" })).exitCode, 0);
    assert.equal((await run(course.steps[5].command, { cwd: "/root/lab" })).exitCode, 0);
    assert.equal((await run("cat notes.txt", { cwd: "/root/lab" })).stdout.trim(), "hello linux");

    for (const step of course.steps) {
      if (!step.verify) continue;
      const result = await run(step.verify.sh);
      assert.equal(result.exitCode, 0, `verify failed for "${step.title}": ${step.verify.label}`);
    }
  } finally {
    await vm.exec("sh", ["-c", "poweroff"]).catch(() => {});
  }
});
