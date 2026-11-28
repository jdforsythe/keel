/** The form each package manager runs a project's `keel` with: k.create-manager's table, held equal by test/keelForm.test.ts. */
const FORMS: Readonly<Record<string, string>> = {
  pnpm: "pnpm keel",
  npm: "npx --no keel",
  yarn: "yarn keel",
  bun: "bun run keel",
};

/**
 * How a person runs `keel` from where this run was started (k.cli Command form): the form of the package manager
 * `npm_config_user_agent` names, else `keel`. A table, not `@keel/scaffold`, so the binary's start loads nothing more.
 */
export function keelForm(userAgent: string | undefined): string {
  const name = (userAgent ?? "").split(" ")[0]?.split("/")[0] ?? "";
  return FORMS[name] ?? "keel";
}
