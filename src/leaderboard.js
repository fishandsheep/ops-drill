const NAME_KEY = "ops:name";
const SCORES_KEY = "ops:scores";

export function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage may be unavailable */
  }
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(all) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
}

function sorted(entries) {
  return entries.slice().sort((a, b) => a.ms - b.ms || a.at - b.at);
}

function localBoard(challengeId) {
  const entries = readLocal()[challengeId] || [];
  return { mode: "local", total: entries.length, scores: sorted(entries).slice(0, 20) };
}

async function request(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(4000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("leaderboard service returned no JSON");
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function probeServer() {
  try {
    const data = await request("/api/health");
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function startAttempt(challengeId) {
  try {
    const data = await request("/api/attempts", {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    });
    return { mode: "server", token: data.token, startedAt: data.startedAt };
  } catch {
    return { mode: "local", token: null, startedAt: Date.now() };
  }
}

export async function fetchScores(challengeId) {
  try {
    const data = await request(`/api/scores?challengeId=${encodeURIComponent(challengeId)}`);
    return { mode: "server", total: data.total, scores: data.scores };
  } catch {
    return localBoard(challengeId);
  }
}

export async function submitScore({ challengeId, token, name, ms }) {
  if (token) {
    try {
      const data = await request("/api/scores", {
        method: "POST",
        body: JSON.stringify({ token, name }),
      });
      return { mode: "server", ...data };
    } catch {
      // Fall through to the local board so a solve is never lost.
    }
  }

  const all = readLocal();
  const entries = all[challengeId] || (all[challengeId] = []);
  const existing = entries.find((entry) => entry.name === name);
  const improved = !existing || ms < existing.ms;
  if (improved) {
    if (existing) {
      existing.ms = ms;
      existing.at = Date.now();
    } else {
      entries.push({ name, ms, at: Date.now() });
    }
    writeLocal(all);
  }
  const board = sorted(entries);
  return {
    mode: "local",
    improved,
    elapsed: ms,
    rank: board.findIndex((entry) => entry.name === name) + 1,
    total: board.length,
    scores: board.slice(0, 20),
  };
}
