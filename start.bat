import { spawn } from "child_process";

// Kiểm tra nếu là Windows thì dùng cmd.exe, Linux/macOS thì dùng npm trực tiếp
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const child = spawn(npmCmd, ["install"], {
  cwd: "./backend",
  stdio: "inherit",
  shell: isWindows, // Chỉ bật shell trên Windows
});