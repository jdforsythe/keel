// A stand-in for a Stryker core that ignores SIGINT and leaves a child of its own in the same process group:
// the case tooling/test/mutate-group.test.ts kills by group.
import { spawn } from "node:child_process";

process.on("SIGINT", () => {});
if (process.argv[2] !== "child") {
  const child = spawn(process.execPath, [import.meta.filename, "child"], { stdio: "ignore" });
  process.stdout.write(`${child.pid}\n`);
}
setInterval(() => {}, 1000);
