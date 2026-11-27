const MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);

/**
 * The manager `npm_config_user_agent` names (k.create Package manager): the name before `/` in its first word when it
 * is pnpm, npm, yarn or bun, else pnpm, and the `packageManager` value that word gives (`npm@10.9.0`; none when the
 * variable is absent or names another manager).
 */
export function managerWord(userAgent: string | undefined): {
  readonly packageManager: string | undefined;
  readonly name: string;
} {
  const [name = "", version = ""] = (userAgent?.split(" ")[0] ?? "").split("/");
  return MANAGERS.has(name) && version !== ""
    ? { packageManager: `${name}@${version}`, name }
    : { packageManager: undefined, name: MANAGERS.has(name) ? name : "pnpm" };
}
