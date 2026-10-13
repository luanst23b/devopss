import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDirectory = path.resolve(backendDirectory, "..");
const frontendDirectory = path.join(projectDirectory, "frontend");
const require = createRequire(import.meta.url);
const viteEntry = path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js");
const children = [];
let shuttingDown = false;

function installDependencies(directory) {
  return new Promise((resolve, reject) => {
    const installer = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm install"], {
      cwd: directory,
      stdio: "inherit",
      windowsHide: true,
    });
    installer.once("error", reject);
    installer.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed in ${path.relative(projectDirectory, directory)}.`));
    });
  });
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function waitForService(url, childProcesses, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childProcesses.some((child) => child.exitCode !== null)) {
      throw new Error("A service stopped unexpectedly. Check the logs above.");
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // A newly started local server may need a few seconds before accepting requests.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}. Check the logs above.`);
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

function launch(label, executable, args, options) {
  const child = spawn(executable, args, {
    ...options,
    stdio: "inherit",
    windowsHide: false,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    stopChildren();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${label} stopped${signal ? ` (${signal})` : ` with exit code ${code}`}.`);
      process.exitCode = code || 1;
      stopChildren();
    }
  });
  return child;
}

async function main() {
  const backendDependencyMissing = !(await pathExists(path.join(backendDirectory, "node_modules", "mssql", "package.json")));
  const frontendDependencyMissing = !(await pathExists(viteEntry));
  if (backendDependencyMissing) {
    console.log("Installing backend dependencies...");
    await installDependencies(backendDirectory);
  }
  if (frontendDependencyMissing) {
    console.log("Installing frontend dependencies...");
    await installDependencies(frontendDirectory);
  }

  for (const dependencyPath of [require.resolve("mssql"), viteEntry]) {
    try {
      await access(dependencyPath);
    } catch {
      throw new Error(
        `A required dependency is missing (${path.relative(projectDirectory, dependencyPath)}). Install backend and frontend dependencies, then retry.`,
      );
    }
  }

  const databaseSetup = spawn(
    process.execPath,
    [path.join(backendDirectory, "scripts", "init-db.js")],
    { cwd: backendDirectory, stdio: "inherit", windowsHide: true },
  );
  const setupCode = await new Promise((resolve, reject) => {
    databaseSetup.once("error", reject);
    databaseSetup.once("exit", resolve);
  });
  if (setupCode !== 0) throw new Error("Database setup did not complete.");

  if (!(await isPortAvailable(4000))) {
    throw new Error("Port 4000 is already in use. Stop the application using it and retry.");
  }
  const frontendPort = (await isPortAvailable(5173)) ? 5173 : 5174;
  const apiUrl = "http://localhost:4000/api";
  const frontendUrl = `http://localhost:${frontendPort}`;

  console.log("\nStarting API and website in this terminal. Press Ctrl+C to stop both.\n");
  const backend = launch("Backend API", process.execPath, ["src/server.js"], {
    cwd: backendDirectory,
    env: { ...process.env, CLIENT_ORIGIN: frontendUrl },
  });
  const frontend = launch(
    "Frontend",
    process.execPath,
    [viteEntry, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
    {
      cwd: frontendDirectory,
      env: { ...process.env, VITE_API_URL: apiUrl },
    },
  );

  await Promise.all([
    waitForService(`${apiUrl}/health`, [backend, frontend]),
    waitForService(frontendUrl, [backend, frontend]),
  ]);

  console.log(`\nWebsite: ${frontendUrl}`);
  console.log(`API:     ${apiUrl}`);
  const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", frontendUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.unref();
}

process.on("SIGINT", () => {
  console.log("\nStopping TechZone services...");
  stopChildren();
});
process.on("SIGTERM", stopChildren);

main().catch((error) => {
  console.error(`\n${error.message}`);
  stopChildren();
  process.exitCode = 1;
});
