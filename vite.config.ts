// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// IALE ships as a purely static single-page app: every piece of state (BYOK key,
// saved machines, progress, mistake stats) lives in the browser, and the tutor
// calls the student's own provider directly. There is no per-request server data
// dependency anywhere, so SPA mode + prerender of the shell is the honest target
// and no server runtime (nor Netlify Function) is needed at runtime: the static
// assets in dist/client are the whole deployable.
// NVIDIA's integrate API sends no CORS headers, so a browser cannot call it
// directly. This same-origin pass-through path (mirrored by netlify.toml in
// production) forwards the request upstream; the student's key is only relayed,
// never stored or logged.
export default defineConfig({
  server: {
    proxy: {
      "/api-proxy/nvidia": {
        target: "https://integrate.api.nvidia.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/api-proxy\/nvidia/, ""),
      },
    },
  },
  nitro: false,
  tanstackStart: {
    spa: { enabled: true, prerender: { crawlLinks: false } },
    prerender: { enabled: true, crawlLinks: true },
  },
});
