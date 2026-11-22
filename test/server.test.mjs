import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { start } from "../server/index.mjs";

async function boot() {
  const dataDir = await mkdtemp(join(tmpdir(), "ops-drill-"));
  const app = await start({ port: 0, dataDir });
  const base = `http://127.0.0.1:${app.port}`;
  return { app, base, dataDir };
}

test("attempts are server-timed and scores rank best-per-name", { timeout: 20_000 }, async () => {
  const { app, base, dataDir } = await boot();
  try {
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.ok(health.challenges.includes("disk-full-logs"));

    const attempt = await fetch(`${base}/api/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: "disk-full-logs" }),
    }).then((r) => r.json());
    assert.ok(attempt.token);
    assert.ok(attempt.startedAt <= Date.now());

    await new Promise((resolve) => setTimeout(resolve, 900));

    const first = await fetch(`${base}/api/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: attempt.token, name: "  kobayashi  " }),
    }).then((r) => r.json());
    assert.equal(first.rank, 1);
    assert.equal(first.total, 1);
    assert.ok(first.elapsed >= 800);
    assert.equal(first.scores[0].name, "kobayashi");

    const replay = await fetch(`${base}/api/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: attempt.token, name: "kobayashi" }),
    });
    assert.equal(replay.status, 409);

    const board = await fetch(`${base}/api/scores?challengeId=disk-full-logs`).then((r) =>
      r.json()
    );
    assert.equal(board.total, 1);
    assert.equal(board.scores[0].name, "kobayashi");

    const bad = await fetch(`${base}/api/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "nope.nope", name: "x" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("serves the app with isolation headers and wasm MIME", { timeout: 20_000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ops-drill-"));
  const staticDir = await mkdtemp(join(tmpdir(), "ops-static-"));
  await writeFile(
    join(staticDir, "index.html"),
    "<!doctype html><title>drill</title>",
    "utf8"
  );
  await mkdir(join(staticDir, "assets"));
  await writeFile(join(staticDir, "assets", "k.wasm"), "wasm");
  const app = await start({ port: 0, dataDir, staticDir });
  const base = `http://127.0.0.1:${app.port}`;
  try {
    const page = await fetch(`${base}/?c=disk-full-logs`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /drill/);
    assert.equal(page.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(page.headers.get("cross-origin-embedder-policy"), "require-corp");

    const wasm = await fetch(`${base}/assets/k.wasm`);
    assert.equal(wasm.status, 200);
    assert.equal(wasm.headers.get("content-type"), "application/wasm");

    const missing = await fetch(`${base}/assets/nope.js`);
    assert.equal(missing.status, 200);
    assert.match(await missing.text(), /drill/);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
    await rm(staticDir, { recursive: true, force: true });
  }
});
