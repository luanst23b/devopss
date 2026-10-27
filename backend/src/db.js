import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Set it to the PostgreSQL connection URL.");
}

export const pool = new Pool({
  connectionString,
  ...(process.env.PGSSL === "false" ? {} : { ssl: { rejectUnauthorized: false } }),
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

export const sql = {
  ISOLATION_LEVEL: { READ_COMMITTED: "READ COMMITTED" },
  Transaction: class Transaction {
    constructor(connectionPool) {
      this.pool = connectionPool;
      this.client = null;
    }

    async begin(isolationLevel = "READ COMMITTED") {
      this.client = await this.pool.connect();
      try {
        await this.client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      } catch (error) {
        this.client.release();
        this.client = null;
        throw error;
      }
    }

    async commit() {
      try {
        await this.client.query("COMMIT");
      } finally {
        this.client.release();
        this.client = null;
      }
    }

    async rollback() {
      if (!this.client) return;
      try {
        await this.client.query("ROLLBACK");
      } finally {
        this.client.release();
        this.client = null;
      }
    }
  },
};

export async function query(statement, parameters = [], transaction = null) {
  const client = transaction?.client || pool;
  const result = await client.query(statement, parameters);
  return result.rows;
}

export async function execute(statement, parameters = [], transaction = null) {
  const client = transaction?.client || pool;
  const result = await client.query(statement, parameters);
  return {
    recordset: result.rows,
    rowsAffected: [result.rowCount],
    rowCount: result.rowCount,
  };
}