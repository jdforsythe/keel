#!/usr/bin/env node
// The `create-app` binary (k.create): the only file that touches the process. It reads the arguments, the working
// folder, Node's version, whether standard output is a terminal and three environment values, never standard input;
// it catches SIGINT and SIGTERM for the writes.
import { run } from "./run.ts";

const { npm_config_user_agent, KEEL_AGENT, CI } = process.env;
// SIGINT and SIGTERM stop the writes, even one in flight, and the run removes its files (k.create-folder Folder).
let caught: "SIGINT" | "SIGTERM" | undefined;
let interrupt: (signal: "SIGINT" | "SIGTERM") => void = () => undefined;
const interrupted = new Promise<"SIGINT" | "SIGTERM">((settle) => {
  interrupt = settle;
});
const stop = (signal: "SIGINT" | "SIGTERM") => () => {
  caught ??= signal;
  interrupt(signal);
};
process.on("SIGINT", stop("SIGINT"));
process.on("SIGTERM", stop("SIGTERM"));
const r = await run({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  nodeVersion: process.versions.node,
  tty: process.stdout.isTTY === true,
  stopped: () => caught,
  interrupted,
  env: { npm_config_user_agent, KEEL_AGENT, CI },
});
// `run` settles only after an interrupted run removed its files, so the process exits once its output is out.
process.stdout.write(r.stdout, () => process.exit(r.code));
