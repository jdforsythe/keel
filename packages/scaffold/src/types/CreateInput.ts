import type { AgentSkill } from "./AgentSkill.ts";

/**
 * What `createPlan` reads (k.create Package): create's own `version`, the running Node's `nodeVersion`, the `skills` the
 * agent files copy; the flags (`folder` as typed, default `.`); the folder's `listing` (every entry under it, relative,
 * `/`-separated, a folder ending in `/`); `ancestors`, the files Workspace names above the folder, keyed from the
 * working folder (`../package.json`), or absolute for an absolute `folder` (`ancestorKeys` lists them); the folder's
 * `realPath` (the name of `.`), whether a `.git` is at or above it (`gitAbove`), and `npm_config_user_agent`.
 */
export type CreateInput = {
  readonly version: string;
  readonly nodeVersion: string;
  readonly skills: readonly AgentSkill[];
  readonly folder?: string | undefined;
  readonly name?: string | undefined;
  readonly adapter?: "client" | "node" | "static" | undefined;
  readonly library?: string | undefined;
  readonly existing?: boolean | undefined;
  readonly listing?: readonly string[] | undefined;
  readonly ancestors?: Readonly<Record<string, string>> | undefined;
  readonly realPath?: string | undefined;
  readonly gitAbove?: boolean | undefined;
  readonly userAgent?: string | undefined;
  /** The working folder's real path, which names the folders above it for the workspace's globs. */
  readonly cwd?: string | undefined;
  /** The folder's file system compares names ignoring case, so `agents.md` collides with `AGENTS.md` (E1361). */
  readonly caseless?: boolean | undefined;
};
