import type { Manager } from "./Manager.ts";

/** Actions pinned by commit SHA, the version in a trailing comment (the Keel repository's own pattern). */
const PNPM_SETUP = "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0";
const NODE_SETUP = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0";
const BUN_SETUP = "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0";

const node = (cache: string | null): string[] => [
  `      - uses: ${NODE_SETUP}`,
  "        with:",
  "          node-version: 22",
  ...(cache === null ? [] : [`          cache: ${cache}`]),
];

/**
 * The manager of a `packageManager` value (`"<name>@<version>"`, k.create-manager Package manager): pnpm, npm, yarn or bun,
 * and pnpm for none or another name. Yarn 1 installs in CI with `--frozen-lockfile`, later yarn with `--immutable`
 * after `corepack enable`; bun's setup reads its version from `package.json`.
 */
export function managerOf(packageManager: string | undefined): Manager {
  const at = packageManager?.lastIndexOf("@") ?? -1;
  const name = packageManager === undefined || at <= 0 ? "pnpm" : packageManager.slice(0, at);
  const version = packageManager === undefined || at <= 0 ? "" : packageManager.slice(at + 1);
  switch (name) {
    case "npm":
      return {
        name,
        install: "npm install",
        run: "npx --no keel",
        ci: "npm ci",
        lock: "package-lock\\.json",
        lockfile: "package-lock.json",
        setup: node("npm"),
        exec: "npx --no keel",
      };
    case "yarn":
      return {
        name,
        install: "yarn install",
        run: "yarn keel",
        ci: version.startsWith("1.") ? "yarn install --frozen-lockfile" : "yarn install --immutable",
        lock: "yarn\\.lock",
        lockfile: "yarn.lock",
        setup: [...node(null), "      - run: corepack enable"],
        exec: "yarn keel",
      };
    case "bun":
      return {
        name,
        install: "bun install",
        run: "bun run keel",
        ci: "bun install --frozen-lockfile",
        lock: "bun\\.lockb?",
        lockfile: "bun.lock",
        setup: [
          ...node(null),
          `      - uses: ${BUN_SETUP}`,
          "        with:",
          "          bun-version-file: package.json",
        ],
        exec: "bun run keel",
      };
    default:
      return {
        name: "pnpm",
        install: "pnpm install",
        run: "pnpm keel",
        ci: "pnpm install --frozen-lockfile",
        lock: "pnpm-lock\\.yaml",
        lockfile: "pnpm-lock.yaml",
        setup: [`      - uses: ${PNPM_SETUP}`, ...node("pnpm")],
        exec: "pnpm exec keel",
      };
  }
}
