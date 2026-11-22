import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { challenges, getChallenge } from "../src/challenges/index.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_NAME = 16;
const MAX_ELAPSED_MS = 6 * 60 * 60 * 1000;
const MIN_ELAPSED_MS = 800;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sanitizeName(name) {
  if (typeof name !== "string") return null;
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_NAME);
  return cleaned.length > 0 ? cleaned : null;
}

async function readBody(req, limit = 4096) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function start({
  port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "0.0.0.0",
  dataDir = process.env.DATA_DIR || join(root, "data"),
  staticDir = join(root, "dist"),
} = {}) {
  await mkdir(dataDir, { recursive: true });

  const scoreFile = join(dataDir, "scores.json");
  const secretFile = join(dataDir, "secret");

  let secret;
  try {
    secret = (await readFile(secretFile, "utf8")).trim();
  } catch {
    secret = randomBytes(32).toString("hex");
    await writeFile(secretFile, secret, { mode: 0o600 });
  }

  let scores = {};
  try {
    scores = JSON.parse(await readFile(scoreFile, "utf8"));
  } catch {
    scores = {};
  }

  const usedTokens = new Set();
  const buckets = new Map();

  function sign(payload) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
  }

  function issueToken(challengeId) {
    const startedAt = Date.now();
    const payload = Buffer.from(
      JSON.stringify({ c: challengeId, t: startedAt, n: randomUUID() })
    ).toString("base64url");
    return { token: `${payload}.${sign(payload)}`, startedAt };
  }

  function readToken(token) {
    if (typeof token !== "string" || token.length > 512) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!data.c || !data.t || !data.n) return null;
      return data;
    } catch {
      return null;
    }
  }

  function board(challengeId) {
    return (scores[challengeId] || [])
      .slice()
      .sort((x, y) => x.ms - y.ms || x.at - y.at);
  }

  function rankOf(challengeId, name) {
    const index = board(challengeId).findIndex((entry) => entry.name === name);
    return index === -1 ? null : index + 1;
  }

  async function persist() {
    const tmp = `${scoreFile}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(scores, null, 2));
    await rename(tmp, scoreFile);
  }

  function rateLimited(ip, limit, windowMs = 60_000) {
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now - bucket.start > windowMs) {
      buckets.set(ip, { start: now, count: 1 });
      return false;
    }
    bucket.count += 1;
    return bucket.count > limit;
  }

  function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  }

  async function api(req, res, url) {
    const ip = clientIp(req);

    if (req.method === "POST" && url.pathname === "/api/attempts") {
      if (rateLimited(ip, 40)) return json(res, 429, { error: "too many attempts" });
      let input;
      try {
        input = await readBody(req);
      } catch {
        return json(res, 400, { error: "bad request" });
      }
      const challenge = getChallenge(input.challengeId);
      if (!challenge) return json(res, 404, { error: "unknown challenge" });
      return json(res, 200, issueToken(challenge.id));
    }

    if (req.method === "GET" && url.pathname === "/api/scores") {
      const challenge = getChallenge(url.searchParams.get("challengeId"));
      if (!challenge) return json(res, 404, { error: "unknown challenge" });
      const all = board(challenge.id);
      return json(res, 200, {
        challengeId: challenge.id,
        total: all.length,
        scores: all.slice(0, 20),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/scores") {
      if (rateLimited(ip, 15)) return json(res, 429, { error: "too many submissions" });
      let input;
      try {
        input = await readBody(req);
      } catch {
        return json(res, 400, { error: "bad request" });
      }
      const data = readToken(input.token);
      if (!data) return json(res, 400, { error: "invalid attempt" });
      if (usedTokens.has(data.n)) return json(res, 409, { error: "attempt already used" });
      const challenge = getChallenge(data.c);
      if (!challenge) return json(res, 404, { error: "unknown challenge" });
      const name = sanitizeName(input.name);
      if (!name) return json(res, 400, { error: "invalid name" });

      const elapsed = Date.now() - Number(data.t);
      if (!Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS) {
        return json(res, 400, { error: "attempt too short" });
      }
      const ms = Math.min(elapsed, MAX_ELAPSED_MS);
      usedTokens.add(data.n);

      const entries = scores[challenge.id] || (scores[challenge.id] = []);
      const existing = entries.find((entry) => entry.name === name);
      const improved = !existing || ms < existing.ms;
      if (improved) {
        if (existing) {
          existing.ms = ms;
          existing.at = Date.now();
        } else {
          entries.push({ name, ms, at: Date.now() });
        }
        await persist();
      }

      return json(res, 200, {
        challengeId: challenge.id,
        elapsed: ms,
        improved,
        rank: rankOf(challenge.id, name),
        total: entries.length,
        scores: board(challenge.id).slice(0, 20),
      });
    }

    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true, challenges: challenges.map((c) => c.id) });
    }

    return json(res, 404, { error: "not found" });
  }

  function safePath(pathname) {
    const decoded = decodeURIComponent(pathname);
    const target = resolve(join(staticDir, normalize(decoded).replace(/^(\.\.[/\\])+/, "")));
    if (target !== staticDir && !target.startsWith(staticDir + "/")) return null;
    return target;
  }

  async function serve(req, res, url) {
    if (!existsSync(staticDir)) {
      res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      res.end("dist/ is missing. Run `npm run build` first.\n");
      return;
    }

    let target = safePath(url.pathname === "/" ? "/index.html" : url.pathname);
    if (!target) {
      res.writeHead(400);
      res.end("bad path");
      return;
    }

    try {
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, "index.html");
    } catch {
      target = join(staticDir, "index.html");
    }

    const type = mime[extname(target)] || "application/octet-stream";
    const headers = {
      "content-type": type,
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "same-origin",
      "cache-control": target.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      return await serve(req, res, url);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
      else res.end();
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolveListen);
  });

  return {
    server,
    port: server.address().port,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const app = await start();
  console.log(`OPS//DRILL on http://localhost:${app.port}`);
  console.log(`challenges: ${challenges.map((c) => c.id).join(", ")}`);
}
