import "dotenv/config";
import sql from "mssql";

const dbServer = process.env.DB_SERVER?.trim();
const dbInstance = process.env.DB_INSTANCE?.trim();
const dbName = process.env.DB_NAME?.trim();
const dbUser = process.env.DB_USER?.trim();
const dbPassword = process.env.DB_PASSWORD;
const dbPortValue = process.env.DB_PORT?.trim();

if (!dbServer || !dbName || !dbUser || !dbPassword
  || (!dbInstance && !dbPortValue)) {
  throw new Error(
    "SQL Server settings are missing. Set DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, "
    + "and either DB_INSTANCE (local SQL Server) or DB_PORT (hosted SQL Server, usually 1433).",
  );
}

const dbPort = dbPortValue ? Number(dbPortValue) : undefined;
if (dbPortValue && (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65_535)) {
  throw new Error("DB_PORT must be a valid TCP port number between 1 and 65535.");
}
if (dbInstance && dbPort) {
  throw new Error("Set either DB_INSTANCE or DB_PORT, not both.");
}

function booleanSetting(name, fallback) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be set to true or false.`);
}

export const pool = new sql.ConnectionPool({
  server: dbServer,
  ...(dbPort ? { port: dbPort } : {}),
  database: dbName,
  user: dbUser,
  password: dbPassword,
  options: {
    ...(dbInstance ? { instanceName: dbInstance } : {}),
    encrypt: booleanSetting("DB_ENCRYPT", Boolean(dbPort)),
    trustServerCertificate: booleanSetting("DB_TRUST_SERVER_CERTIFICATE", !dbPort),
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
