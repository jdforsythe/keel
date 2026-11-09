// `@keel/std-sessions/tools` (rfc:0070): the node-only half that `importDeps` loads for `keel check`, `keel build` and
// `keel session`: check rules E2001 and E2005, the `session` record formatter, the std config schema, and the
// `session` command (`stdCommand`).
import { stdCommand } from "@keel/cli";
import "./SessionsConfig.ts";
import "./SessionRecord.ts";
import "./adapterNotNode.ts";
import "./redactPath.ts";
import { command } from "./command.ts";

stdCommand("session", command);
