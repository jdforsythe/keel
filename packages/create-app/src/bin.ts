#!/usr/bin/env node
// The `create-app` binary (k.create): the only file that touches the process. It reads the arguments, the working
// folder, Node's version, whether standard output is a terminal and three environment values, never standard input;
// it catches SIGINT and SIGTERM for the writes.
import { run } from "./run.ts";

const { npm_config_user_agent, KEEL_AGENT, CI } = process.env;
// SIGINT and SIGTERM stop the writes between two files, which the run then removes (k.create-folder Folder).
let caught: "SIGINT" | "SIGTERM" | undefined;
const stop = (signal: "SIGINT" | "SIGTERM") => () => {
  caught = signal;
};
process.on("SIGINT", stop("SIGINT"));
process.on("SIGTERM", stop("SIGTERM"));
const r = await run({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  nodeVersion: process.versions.node,
  tty: process.stdout.isTTY === true,
  stopped: () => caught,
  env: { npm_config_user_agent, KEEL_AGENT, CI },
});
process.exitCode = r.code;
process.stdout.write(r.stdout);
