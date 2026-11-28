// re-exports only (`@keel/scaffold/agents`: the agent files `keel scaffold project`, `keel docs --sync` and
// `keel check` share, apart from the main entry so the commands that never touch them do not load them)
export type { AgentSkill } from "../types/AgentSkill.ts";
export { AGENTS_END } from "./AGENTS_END.ts";
export { AGENTS_START } from "./AGENTS_START.ts";
export { agentFiles } from "./agentFiles.ts";
