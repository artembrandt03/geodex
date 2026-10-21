import { databaseLabel, loadConfig } from "./lib/config.mjs";
import { createAdminServer } from "./lib/server.mjs";

/**
 * Starts the owner's dashboard: `npm run admin` (your local database) or
 * `npm run admin:demo` (a database filled with made-up data). It is local only: it
 * listens on 127.0.0.1 and nothing about it is deployed.
 */
const config = loadConfig();
const app = createAdminServer(config);

try {
  await app.listen();
} catch (error) {
  console.error(
    error?.code === "EADDRINUSE"
      ? `Port ${config.port} is already in use. Set ADMIN_PORT in admin/.env, or stop the other dashboard.`
      : `Could not start the dashboard: ${error?.message ?? error}`,
  );
  process.exit(1);
}

console.log(`\n  Geodex admin dashboard`);
console.log(`  http://localhost:${config.port}`);
console.log(`  reading (read only): ${databaseLabel(config.databaseUrl)}${config.demo ? "  [demo data]" : ""}\n`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
