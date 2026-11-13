// Fixture: a process that holds the mutation lock until it is killed. Its file name carries "mutate" like the real
// commands, which is what the lock checks of a holder. `--child` also starts `taker-mutate.mjs` under it.
import { spawn } from "node:child_process";
import path from "node:path";
import { acquire } from "../../mutateLock.mjs";

const lock = acquire({ file: process.argv[2] });
console.log(lock.held ? "held" : "refused");
if (process.argv.includes("--child"))
  spawn(process.execPath, [path.join(import.meta.dirname, "taker-mutate.mjs"), process.argv[2]], { stdio: "inherit" });
setInterval(() => {}, 1000);
