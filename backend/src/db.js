import "dotenv/config";
import sql from "mssql";

if (!process.env.DB_SERVER || !process.env.DB_INSTANCE || !process.env.DB_NAME
  || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error("SQL Server settings are missing. Start the project with start.bat to configure the database.");
}

export const pool = new sql.ConnectionPool({
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    instanceName: process.env.DB_INSTANCE,
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
});

function createRequest(transaction) {
  return transaction ? new sql.Request(transaction) : pool.request();
}

function bindParameters(request, statement, parameters) {
  let index = 0;
  const text = statement.replace(/\?/g, () => {
    const name = `p${index}`;
    const value = parameters[index] ?? null;
    if (typeof value === "boolean") {
      request.input(name, sql.Bit, value);
    } else if (typeof value === "number") {
      request.input(
        name,
        Number.isInteger(value)
          ? sql.BigInt
          : sql.Decimal(19, 4),
        value,
      );
    } else if (value === null) {
      request.input(name, sql.NVarChar, null);
    } else if (typeof value === "string") {
      request.input(name, value.length > 4000 ? sql.NVarChar(sql.MAX) : sql.NVarChar(Math.max(1, value.length)), value);
    } else {
      throw new TypeError(`Unsupported SQL parameter type: ${typeof value}.`);
    }
    index += 1;
    return `@${name}`;
  });
  if (index !== parameters.length) {
    throw new Error(`SQL parameter count mismatch: expected ${index}, received ${parameters.length}.`);
  }
  return text;
}

export async function query(statement, parameters = [], transaction = null) {
  const request = createRequest(transaction);
  const text = bindParameters(request, statement, parameters);
  return (await request.query(text)).recordset;
}

export async function execute(statement, parameters = [], transaction = null) {
  const request = createRequest(transaction);
  const text = bindParameters(request, statement, parameters);
  return request.query(text);
}

export { sql };
