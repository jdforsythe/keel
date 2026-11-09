#!/usr/bin/env node
// `keel-session-action`: the process entry the std.sessions Action runs in the project directory. It prints the
// compact records of `runAction` over the process io and exits with its code.
import { actionHost } from "./internal/actionHost.ts";
import { runAction } from "./runAction.ts";

const r = await runAction(actionHost());
process.stdout.write(r.stdout);
process.exitCode = r.code;
