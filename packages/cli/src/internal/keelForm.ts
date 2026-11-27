import { managerOf } from "@keel/scaffold/create";

const MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);

/**
 * How a person runs `keel` from where this run was started (k.cli): the form of the package manager
 * `npm_config_user_agent` names (`pnpm keel`, `npx --no keel`, `yarn keel`, `bun run keel`), else `keel`.
 */
export function keelForm(userAgent: string | undefined): string {
  const name = (userAgent ?? "").split(" ")[0]?.split("/")[0] ?? "";
  return MANAGERS.has(name) ? managerOf(`${name}@`).run : "keel";
}
