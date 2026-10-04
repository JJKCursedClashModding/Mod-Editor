// Portable `npm run electron:dev`: points Electron at the Vite dev server.
// Usage: terminal 1 → npm run dev:frontend · terminal 2 → npm run electron:dev
const { spawn } = require("child_process");

const child = spawn(
  process.execPath,
  [require.resolve("electron/cli.js"), "."],
  {
    env: { ...process.env, VITE_DEV_SERVER_URL: "http://localhost:5173" },
    stdio: "inherit",
    cwd: __dirname + "/..",
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
