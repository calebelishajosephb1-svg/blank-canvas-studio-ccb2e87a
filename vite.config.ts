// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// IALE ships as a purely static single-page app: every piece of state (BYOK key,
// saved machines, progress, mistake stats) lives in the browser, and the tutor
// calls the student's own provider directly. There is no per-request server data
// dependency anywhere, so SPA mode + prerender of the shell is the honest target
// and no server runtime (nor Netlify Function) is needed at runtime: the static
// assets in dist/client are the whole deployable.

/**
 * Dev-only CORS pass-through.
 *
 * NVIDIA's integrate API sends no Access-Control-Allow-Origin header at all, so
 * a browser can never call it directly. This middleware relays `/api-proxy/nvidia/*`
 * upstream during local development; in production the same path is rewritten by
 * the redirect rule in netlify.toml. Nothing is stored or logged — the student's
 * key is only forwarded, exactly as the browser sent it.
 */
function nvidiaCorsProxy(): Plugin {
  const PREFIX = "/api-proxy/nvidia";
  return {
    name: "iale:nvidia-cors-proxy",
    // `pre` + configureServer's early hook so the SSR handler never sees these URLs.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(PREFIX)) return next();
        const upstream = "https://integrate.api.nvidia.com" + (url.slice(PREFIX.length) || "/");
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers))
            if (typeof v === "string" && !/^(host|origin|referer|connection)$/i.test(k))
              headers[k] = v;
          fetch(upstream, {
            method: req.method,
            headers,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          })
            .then(async (r) => {
              res.statusCode = r.status;
              res.setHeader("content-type", r.headers.get("content-type") ?? "application/json");
              res.setHeader("access-control-allow-origin", "*");
              res.end(Buffer.from(await r.arrayBuffer()));
            })
            .catch((e: Error) => {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: e.message }));
            });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [nvidiaCorsProxy()],
  nitro: false,
  tanstackStart: {
    spa: { enabled: true, prerender: { crawlLinks: false } },
    prerender: { enabled: true, crawlLinks: true },
  },
});

