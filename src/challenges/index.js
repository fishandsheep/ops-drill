import accessLogReport from "./access-log-report.js";
import bindLocalhost from "./bind-localhost.js";
import config from "./config.js";
import crlfDeploy from "./crlf-deploy.js";
import deletedFileSpace from "./deleted-file-space.js";
import diskFull from "./disk-full.js";
import execBitDeploy from "./exec-bit-deploy.js";
import hostsDrift from "./hosts-drift.js";
import inodeExhaustion from "./inode-exhaustion.js";
import permissions from "./perm-app-data.js";
import portConflict from "./port-conflict.js";
import routeMissing from "./route-missing.js";
import stuckLock from "./stuck-lock.js";
import symlinkRelease from "./symlink-release.js";

/** The pool. Add a file and list it here to put it into the rotation. */
export const challenges = [
  diskFull,
  inodeExhaustion,
  deletedFileSpace,
  permissions,
  execBitDeploy,
  config,
  stuckLock,
  symlinkRelease,
  crlfDeploy,
  accessLogReport,
  portConflict,
  bindLocalhost,
  hostsDrift,
  routeMissing,
];

export function getChallenge(id) {
  return challenges.find((challenge) => challenge.id === id) ?? null;
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayNumber(date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
}

/**
 * Every day gets two challenges, rotating through the pool. With only three
 * in the pool a challenge repeats every three days; add more to widen it.
 */
export function challengesForDate(date = new Date()) {
  if (challenges.length === 0) return [];
  const day = dayNumber(date);
  const count = Math.min(2, challenges.length);
  return Array.from({ length: count }, (_, i) => challenges[(day + i) % challenges.length]);
}

export function todayChallenges() {
  return challengesForDate(new Date());
}

export function archive(days = 7, from = new Date()) {
  const out = [];
  for (let i = 1; i <= days; i += 1) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
    out.push({ date, key: dateKey(date), challenges: challengesForDate(date) });
  }
  return out;
}

export function millisecondsLabel(ms) {
  if (ms == null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
