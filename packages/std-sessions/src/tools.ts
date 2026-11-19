// `@keel/std-sessions/tools`: the node-only half that `importDeps` loads for `keel check`, `keel build` and
// `keel session`: check rules E2001, E2005 and E2009, the E2007 and E2008 explanations, the `session` and
// `session.monitor` record formatters, the std config schema, and the `session` command (`stdCommand`).
import { stdCommand } from "@keel/cli";
import "./SessionsConfig.ts";
import "./sessionFormatter.ts";
import "./adapterNotNode.ts";
import "./monitorNotNode.ts";
import "./SessionMonitorRecord.ts";
import "./redactPath.ts";
import "./groupRules.ts";
import { command } from "./command.ts";

stdCommand("session", command);
