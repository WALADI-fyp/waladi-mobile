const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgres://tsdbadmin:snu0ylxbjv6i4cwp@v10mr1yybq.l0d10leccx.tsdb.cloud.timescale.com:30263/tsdb",
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log("Existing tables:", res.rows.map((r) => r.tablename));
  } catch (err) {
    console.error("DB error:", err.message);
  }
  await pool.end();
})();
