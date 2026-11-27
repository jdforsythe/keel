#!/usr/bin/env node
// The `create-app` binary (k.create): the only file that touches the process. It reads the arguments, the working
// folder, Node's version, whether standard output is a terminal and three environment values, never standard input.
import { run } from "./run.ts";

const { npm_config_user_agent, KEEL_AGENT, CI } = process.env;
const r = run({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  nodeVersion: process.versions.node,
  tty: process.stdout.isTTY === true,
  env: { npm_config_user_agent, KEEL_AGENT, CI },
});
process.exitCode = r.code;
process.stdout.write(r.stdout);
