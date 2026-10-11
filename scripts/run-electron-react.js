// Portable `npm run start:react`: launch Electron with the built React frontend.
// Sets JJK_USE_REACT=1 so main.js loads frontend/dist (falls back to
// renderer/ if no build exists). No cross-env dependency.
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const child = spawn(process.execPath, [require.resolve("electron/cli.js"), "."], {
  env: { ...process.env, JJK_USE_REACT: "1" },
  stdio: "inherit",
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 0));
