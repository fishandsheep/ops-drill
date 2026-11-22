import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "node_modules", "unkernel", "dist", "unkernel.wasm");
const to = join(root, "public", "unkernel.wasm");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);

const mib = (statSync(to).size / 1024 / 1024).toFixed(1);
console.log(`public/unkernel.wasm (${mib} MiB) <- unkernel/dist/unkernel.wasm`);
