import { defineConfig } from "vite";

// The lab needs a cross-origin isolated page to run the kernel in a worker
// (and for SMP later). Keep these headers on the lab origin only when you
// deploy: marketing pages that embed third-party assets should not get them.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  // The kernel is imported with ?url and emitted once by the bundler.
  publicDir: false,
  server: {
    headers: isolation,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  preview: { headers: isolation },
  build: { target: "esnext" },
});
