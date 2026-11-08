// ============================================================
// Tiger Data (Postgres + TimescaleDB) for saved paths.
// If DATABASE_URL isn't set (or pg isn't installed), saving is simply turned off
// and the rest of Orbit keeps working.
// ============================================================

let pool = null;

export const dbReady = () => pool !== null;
export const query = (text, params) => pool.query(text, params);

export async function setupDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("No DATABASE_URL set: saved paths are turned off.");
    return;
  }

  let pg;
  try {
    pg = (await import("pg")).default;
  } catch {
    console.log('The "pg" package isn\'t installed (run: npm install pg). Saved paths are turned off.');
    return;
  }

  try {
    // The connection is still encrypted (SSL). We skip strict certificate-chain checks because some
    // networks (like campus Wi-Fi) re-sign certificates, which makes Node reject the chain.
    // In production you'd pin Tiger Data's CA certificate instead.
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete("sslmode");   // otherwise it overrides the ssl option below
    const candidate = new pg.Pool({
      connectionString: cleanUrl.toString(),
      ssl: { rejectUnauthorized: false },
      max: 5,
    });

    // Regular table: one row per saved path
    await candidate.query(`
      CREATE TABLE IF NOT EXISTS saved_paths (
        id          SERIAL PRIMARY KEY,
        customer_id TEXT        NOT NULL,
        option_id   TEXT        NOT NULL,
        name        TEXT        NOT NULL,
        path_label  TEXT        NOT NULL,
        assumptions JSONB       NOT NULL,   -- the what-ifs and plans, so we can reopen it exactly
        end_value   INTEGER     NOT NULL,   -- what you'd own after 5 years
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    // Time-series table: the saved path's month-by-month forecast
    await candidate.query(`
      CREATE TABLE IF NOT EXISTS path_forecasts (
        time          TIMESTAMPTZ NOT NULL,
        saved_path_id INTEGER     NOT NULL REFERENCES saved_paths(id) ON DELETE CASCADE,
        net           INTEGER     NOT NULL,   -- what you'd own that month
        savings       INTEGER     NOT NULL    -- cash in savings that month
      )`);

    // Turn it into a TimescaleDB hypertable (partitioned by time, built for time-series queries)
    try {
      await candidate.query(
        `SELECT create_hypertable('path_forecasts', by_range('time', INTERVAL '1 year'), if_not_exists => TRUE)`,
      );
    } catch {
      // older TimescaleDB versions use the classic signature
      await candidate.query(
        `SELECT create_hypertable('path_forecasts', 'time', chunk_time_interval => INTERVAL '1 year', if_not_exists => TRUE)`,
      );
    }
    await candidate.query(
      `CREATE INDEX IF NOT EXISTS path_forecasts_path_time ON path_forecasts (saved_path_id, time DESC)`,
    );

    pool = candidate;
    console.log("Tiger Data connected: saved paths are on.");
  } catch (err) {
    console.error("Couldn't connect to Tiger Data, saved paths are turned off:", err.message);
  }
}
