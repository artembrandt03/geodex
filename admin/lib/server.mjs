import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { ADMIN_DIR, databaseLabel } from "./config.mjs";
import { createDb } from "./db.mjs";
import { PANELS } from "./queries.mjs";
import { SECURITY_HEADERS, isAllowedHost, isAllowedOrigin } from "./security.mjs";

const require = createRequire(import.meta.url);

/** Static files the page needs. Chart.js is served straight from node_modules, so there is no build step. */
const STATIC = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
  "/app.js": ["public/app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["public/style.css", "text/css; charset=utf-8"],
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const json = (res, status, value) =>
  send(res, status, JSON.stringify(value), { "Content-Type": "application/json; charset=utf-8" });

/** Whole number from a query value, clamped to a range, or the fallback. */
function intParam(value, { min, max, fallback }) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * The dashboard's web server. Only the loopback address is listened on, only GET is
 * answered, requests naming another host or coming from another website are refused (see
 * security.mjs), and every query runs read only (see db.mjs).
 */
export function createAdminServer(config) {
  const db = createDb(config.databaseUrl);
  let chartJs = null;

  const server = http.createServer(async (req, res) => {
    try {
      if (!isAllowedHost(req.headers.host, config.port)) {
        return send(res, 403, "Forbidden: this dashboard only answers on localhost.");
      }
      if (
        !isAllowedOrigin(
          { origin: req.headers.origin, secFetchSite: req.headers["sec-fetch-site"] },
          config.port,
        )
      ) {
        return send(res, 403, "Forbidden: cross-site request.");
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
      }

      const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);

      const asset = STATIC[url.pathname];
      if (asset) {
        return send(res, 200, await readFile(path.join(ADMIN_DIR, asset[0])), { "Content-Type": asset[1] });
      }
      if (url.pathname === "/chart.js") {
        chartJs ??= await readFile(path.join(path.dirname(require.resolve("chart.js")), "chart.umd.js"));
        return send(res, 200, chartJs, { "Content-Type": "text/javascript; charset=utf-8" });
      }

      if (url.pathname === "/api/meta") {
        return json(res, 200, {
          database: databaseLabel(config.databaseUrl),
          demo: config.demo,
          serverTime: new Date().toISOString(),
        });
      }

      const panelName = url.pathname.match(/^\/api\/([a-z]+)$/)?.[1];
      const panel = panelName && Object.hasOwn(PANELS, panelName) ? PANELS[panelName] : null;
      if (!panel) return send(res, 404, "Not found");

      const options = {
        days: intParam(url.searchParams.get("days"), { min: 1, max: 365, fallback: 30 }),
        tz: intParam(url.searchParams.get("tz"), { min: -840, max: 840, fallback: 0 }),
        config,
      };
      const data = await db.readOnly((q) => panel(q, options));
      return json(res, 200, { data, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[admin] request failed:", req.url, error?.message ?? error);
      return json(res, 500, { error: "That query failed. See the terminal running the dashboard." });
    }
  });

  return {
    server,
    db,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        // 127.0.0.1 only: not reachable from the network, whatever the machine's firewall does.
        server.listen(config.port, "127.0.0.1", () => resolve(server.address()));
      }),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
