import pg from "pg";

/**
 * Database access for the dashboard, read only by construction.
 *
 * Every query runs inside `BEGIN READ ONLY`, so even if the connection string you give
 * it belongs to a user who could write, the database itself refuses any write. (And you
 * should still give it a read-only user: see admin/sql/create-readonly-role.sql.) A
 * statement timeout stops a runaway query from hanging the database.
 */
export function createDb(connectionString) {
  const url = new URL(connectionString);
  url.search = ""; // pg doesn't know Prisma's ?schema=; real options like sslmode are re-added below
  const original = new URL(connectionString);
  if (original.searchParams.get("sslmode")) url.searchParams.set("sslmode", original.searchParams.get("sslmode"));

  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 4,
    application_name: "geodex-admin",
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on("error", (error) => console.error("[admin] idle database connection error:", error.message));

  /** Runs `work(query)` in one read-only transaction; `query(sql, params)` returns the rows. */
  async function readOnly(work) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '20s'");
      const result = await work(async (sql, params = []) => (await client.query(sql, params)).rows);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return { readOnly, close: () => pool.end() };
}
