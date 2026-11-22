import assert from "node:assert/strict";
import test from "node:test";
import { createKernel } from "unkernel";
import { challenges } from "../src/challenges/index.js";

// Kept out of the client bundle on purpose.
const solutions = {
  "disk-full-logs": ["rm -f /srv/app/data/logs/app.log.1"],
  "inode-exhaustion": ["rm -f /srv/app/data/tmp/session-*"],
  "deleted-file-space": ["kill $(pidof sleep)"],
  "perm-app-data": ["chown -R app:app /srv/app/data"],
  "exec-bit-deploy": ["chmod +x /srv/app/bin/*.sh"],
  "config-drift": ["cp /srv/backup/app.conf.bak /srv/app/etc/app.conf"],
  "stuck-lock": ["kill $(cat /srv/app/data/.lock)", "rm -f /srv/app/data/.lock"],
  "symlink-release": ["ln -sfn /srv/app/releases/2026-11-22 /srv/app/current"],
  "crlf-deploy": ["sed -i 's/\r$//' /srv/app/bin/deploy.sh"],
  "port-conflict": [
    "pkill -f 'bin/legacy-worker[.]sh'",
    "sleep 0.4",
    "kill $(fuser 8080/tcp 2>/dev/null) 2>/dev/null || true",
    "sleep 0.4",
    "nohup /srv/app/bin/start-api.sh >/dev/null 2>&1 &",
    "sleep 1.2",
  ],
  "bind-localhost": [
    "sed -i 's/^BIND=.*/BIND=0.0.0.0/' /srv/app/etc/api.conf",
    "kill $(cat /srv/app/run/api.pid)",
    "sleep 0.5",
    "nohup /srv/app/bin/api.sh >/dev/null 2>&1 &",
    "sleep 1",
  ],
  "hosts-drift": ["sed -i 's/10.0.0.99/10.0.0.10/' /etc/hosts"],
  "route-missing": ["ip route add 10.0.0.0/24 dev dummy0"],
  "access-log-report": [
    "awk '{print $1}' /srv/app/data/access.log | sort | uniq -c | sort -rn | head -1 | awk '{print $2, $1}' > /srv/app/report.txt",
  ],
};

async function run(vm, command) {
  return vm.exec("sh", ["-c", command]);
}

for (const challenge of challenges) {
  test(`${challenge.id}: breaks, then the fix passes every check`, { timeout: 120_000 }, async () => {
    const vm = await createKernel({ memoryMiB: 256 });
    try {
      for (const setup of challenge.setup) {
        const result = await run(vm, setup);
        assert.equal(
          result.exitCode,
          0,
          `setup failed for ${challenge.id}: ${setup}\n${result.stderr ?? ""}`
        );
      }

      const before = [];
      for (const check of challenge.checks) {
        before.push((await run(vm, check.sh)).exitCode);
      }
      assert.ok(
        before.some((code) => code !== 0),
        `${challenge.id} passes before the fix; the scenario is not broken`
      );

      for (const fix of solutions[challenge.id]) {
        const result = await run(vm, fix);
        assert.equal(result.exitCode, 0, `fix failed: ${fix}\n${result.stderr ?? ""}`);
      }

      for (const check of challenge.checks) {
        const result = await run(vm, check.sh);
        assert.equal(
          result.exitCode,
          0,
          `check failed after the fix for ${challenge.id}: ${check.label}\n${result.stderr ?? ""}`
        );
      }
    } finally {
      await vm.exec("sh", ["-c", "poweroff"]).catch(() => {});
    }
  });
}

test("every challenge has the fields the UI needs", () => {
  for (const challenge of challenges) {
    assert.ok(challenge.id);
    assert.ok(challenge.title);
    assert.ok(challenge.briefing);
    assert.ok(challenge.goal);
    assert.ok(challenge.setup.length > 0);
    assert.ok(challenge.checks.length > 0);
    assert.ok(challenge.parSeconds > 0);
  }
});
