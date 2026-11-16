import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Niepoprawny PORT");
const url = `http://127.0.0.1:${port}`;
const healthy = async () => { try { return (await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const open = () => {
  console.log(`Koczowisko Web: ${url}/web`);
  if (process.platform === "win32") spawn("cmd.exe", ["/c", "start", "", `${url}/web`], { windowsHide: true, stdio: "ignore" });
  else if (process.platform === "darwin") spawn("open", [`${url}/web`], { stdio: "ignore" }).on("error", () => {});
  else spawn("xdg-open", [`${url}/web`], { stdio: "ignore" }).on("error", () => {});
};
if (await healthy()) { open(); } else {
  if (!existsSync(".next/BUILD_ID")) throw new Error("Najpierw uruchom npm run build");
  const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code || 0; });
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
  let started = false;
  for (let i = 0; i < 50 && child.exitCode === null; i++) {
    if (await healthy()) { started = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  if (started) { open(); console.log("Pozostaw to okno otwarte. Ctrl+C zatrzymuje serwer."); }
  else { console.error("Nie można uruchomić serwera. Sprawdź DATABASE_URL i PostgreSQL."); child.kill(); process.exitCode = 1; }
}
