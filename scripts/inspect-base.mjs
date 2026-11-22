import { createKernel } from "unkernel";
const vm = await createKernel({ memoryMiB: 256 });
vm.onOutput(() => {});
async function run(label, cmd) {
  const r = await vm.exec("sh", ["-c", cmd]);
  console.log(`=== ${label} exit=${r.exitCode}`);
  console.log((r.stdout || "").trim().slice(0, 800));
  if (r.stderr) console.log("stderr:", r.stderr.trim().slice(0, 400));
}
await run("prepare", "mkdir -p /srv/app/data/logs /srv/app/data/audit /srv/app/bin; mount -t tmpfs -o size=8m tmpfs /srv/app/data; df -k /srv/app/data");
await run("write-6144", "dd if=/dev/zero of=/srv/app/data/logs/app.log.1 bs=1k count=6144; echo dd=$?; df -k /srv/app/data; ls -l /srv/app/data/logs");
await run("write-512-more", "dd if=/dev/zero bs=1k count=512 >> /srv/app/data/logs/app.log.1 2>/dev/null; echo dd=$?; df -k /srv/app/data");
await run("free", "df -k /srv/app/data; du -sk /srv/app/data/*");
process.exit(0);
