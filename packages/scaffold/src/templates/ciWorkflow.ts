/** `.github/workflows/ci.yml` of a project: install, check, test, build. Carries the `_generated` marker; read-only. */
export function ciWorkflow(): string {
  return [
    "# _generated: keel scaffold writes this from the task graph. Do not edit by hand.",
    "name: ci",
    "on:",
    "  push:",
    "    branches:",
    "      - main",
    "  pull_request: {}",
    "jobs:",
    "  ci:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: pnpm/action-setup@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    "          cache: pnpm",
    "      - run: pnpm install --frozen-lockfile",
    "      - run: pnpm check",
    "      - run: pnpm test",
    "      - run: pnpm build",
    "",
  ].join("\n");
}
