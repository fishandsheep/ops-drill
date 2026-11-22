import assert from "node:assert/strict";
import test from "node:test";
import { createKernel } from "unkernel";

// The network challenges lean on the busybox base image: loopback sockets,
// /proc/net/tcp, nc listeners and a configurable dummy interface. If upstream
// changes the image, this test fails before the challenge tests do.
test("base image exposes the networking primitives", { timeout: 60_000 }, async () => {
  const vm = await createKernel({ memoryMiB: 256 });
  try {
    const run = (command) => vm.exec("sh", ["-c", command]);

    const listen = await run(
      "printf 'HTTP/1.0 200 OK\\r\\nContent-Length: 3\\r\\n\\r\\nok\\n' | nc -l -s 0.0.0.0 -p 8080 >/dev/null 2>&1 & sleep 1; netstat -lnt; cat /proc/net/tcp"
    );
    assert.equal(listen.exitCode, 0);
    assert.match(listen.stdout, /0\.0\.0\.0:8080/);
    assert.match(listen.stdout, /00000000:1F90/);

    const probe = await run("nc -z -w 1 127.0.0.1 8080");
    assert.equal(probe.exitCode, 0);

    const dummy = await run(
      "ip link set dummy0 up; ip addr add 10.0.0.5/24 dev dummy0; ip route get 10.0.0.10"
    );
    assert.equal(dummy.exitCode, 0);
    assert.match(dummy.stdout, /10\.0\.0\.10 dev dummy0/);
  } finally {
    await vm.exec("sh", ["-c", "poweroff"]).catch(() => {});
  }
});
