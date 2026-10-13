import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import dotenv from "dotenv";
import sql from "mssql";

const execFileAsync = promisify(execFile);
const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDirectory = path.resolve(backendDirectory, "..");
const envPath = path.join(backendDirectory, ".env");
const schemaPath = path.join(projectDirectory, "database", "schema.sql");
const seedPath = path.join(projectDirectory, "database", "seed.sql");
const databaseName = "tech_store";
const loginName = "techzone_app";

dotenv.config({ path: envPath });

function sqlConfig({ server, instanceName, database, user, password }) {
  return {
    server,
    database,
    user,
    password,
    options: {
      instanceName,
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: { max: 1, min: 0 },
    connectionTimeout: 15_000,
    requestTimeout: 120_000,
  };
}

function isConfigured() {
  return Boolean(process.env.DB_SERVER && process.env.DB_INSTANCE && process.env.DB_NAME
    && process.env.DB_USER && process.env.DB_PASSWORD
    && process.env.DB_PASSWORD !== "generated-on-first-start");
}

async function checkConfiguredDatabase() {
  const connection = await new sql.ConnectionPool(sqlConfig({
    server: process.env.DB_SERVER,
    instanceName: process.env.DB_INSTANCE,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })).connect();
  try {
    await connection.request().query("SELECT 1 AS connected");
    const result = await connection.request().query(
      "SELECT COUNT(*) AS productCount FROM dbo.products",
    );
    if (result.recordset[0].productCount === 0) {
      const seed = (await readFile(seedPath, "utf8")).replace(/^\s*USE\s+\[tech_store\]\s*;\s*/i, "");
      await connection.request().batch(seed);
      console.log("Loaded sample products into the empty SQL Server database.");
    }
    console.log(`Connected to SQL Server ${process.env.DB_SERVER}\\${process.env.DB_INSTANCE}, database ${process.env.DB_NAME}.`);
  } finally {
    await connection.close();
  }
}

async function runSqlCmd(server, instanceName, scriptPath) {
  try {
    await execFileAsync("sqlcmd", [
      "-S", `${server}\\${instanceName}`,
      "-E",
      "-b",
      "-f", "65001",
      "-i", scriptPath,
    ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("sqlcmd was not found. Install SQL Server Command Line Utilities or add sqlcmd to PATH.");
    }
    throw new Error(error.stderr?.trim() || error.stdout?.trim() || error.message);
  }
}

async function initializeDatabase() {
  const server = process.env.DB_SERVER || os.hostname();
  const instanceName = process.env.DB_INSTANCE || "SQLEXPRESS";
  const appPassword = randomBytes(36).toString("base64url");
  const escapedPassword = appPassword.replaceAll("'", "''");
  const schema = await readFile(schemaPath, "utf8");
  const seed = await readFile(seedPath, "utf8");
  const appLogin = `
USE [tech_store];
IF USER_ID(N'${loginName}') IS NOT NULL DROP USER [${loginName}];
GO
USE [master];
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${loginName}')
    DROP LOGIN [${loginName}];
CREATE LOGIN [${loginName}]
    WITH PASSWORD = N'${escapedPassword}', CHECK_POLICY = ON;
GO
USE [tech_store];
CREATE USER [${loginName}] FOR LOGIN [${loginName}];
ALTER ROLE [db_datareader] ADD MEMBER [${loginName}];
ALTER ROLE [db_datawriter] ADD MEMBER [${loginName}];
GO
`;
  const scriptPath = path.join(
    os.tmpdir(),
    `techzone-sqlserver-bootstrap-${randomBytes(10).toString("hex")}.sql`,
  );

  try {
    await writeFile(scriptPath, `${schema}\n${seed}\n${appLogin}`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await runSqlCmd(server, instanceName, scriptPath);
  } finally {
    await rm(scriptPath, { force: true });
  }

  const envFile = [
    `DB_SERVER=${server}`,
    `DB_INSTANCE=${instanceName}`,
    `DB_NAME=${databaseName}`,
    `DB_USER=${loginName}`,
    `DB_PASSWORD=${appPassword}`,
    "PORT=4000",
    "CLIENT_ORIGIN=http://localhost:5173",
    `JWT_SECRET=${randomBytes(48).toString("base64url")}`,
    "JWT_EXPIRES_IN=1d",
    "",
  ].join("\n");
  await writeFile(envPath, envFile, { flag: "w" });
  dotenv.config({ path: envPath, override: true });
  console.log("SQL Server database and product catalog are ready. The Windows login and sa password were not saved.");
  await checkConfiguredDatabase();
}

try {
  if (isConfigured()) {
    await checkConfiguredDatabase();
  } else {
    await initializeDatabase();
  }
} catch (error) {
  console.error(`SQL Server setup failed: ${error.message}`);
  if (error.code === "ELOGIN") {
    console.error("Check the SQL Server instance, that your Windows account can administer it, and that SQL Server Authentication (Mixed Mode) is enabled.");
  } else if (error.code === "ETIMEOUT") {
    console.error("Check that the SQL Server instance and SQL Server Browser are running.");
  } else if (error.code === "ESOCKET" || error.code === "ECONNREFUSED") {
    console.error("Check that SQL Server Express is running and that the configured instance name is correct.");
  }
  process.exitCode = 1;
}
