/**
 * `turbo.json` of a project, generated from its task graph (ADR-0009): every task reads the root config
 * and each module folder, in sorted order, so equal module sets give byte-identical output. Carries the
 * `_generated` marker of tooling/generate.mjs; read-only (E1005).
 */
export function turboJson(modules: readonly string[]): string {
  const inputs = [
    "package.json",
    "tsconfig.json",
    "tokens.ts",
    "topology.ts",
    "vite.config.ts",
    ...[...modules].sort().map((m) => `modules/${m}/**`),
  ];
  const graph = {
    $schema: "https://turbo.build/schema.json",
    tasks: {
      check: { dependsOn: [], inputs, outputs: [".keel/**"] },
      test: { dependsOn: ["check"], inputs, outputs: ["coverage/**"] },
      build: { dependsOn: ["check"], inputs, outputs: ["dist/**"] },
    },
  };
  return `// _generated: keel scaffold writes this from the module graph. Do not edit by hand.\n${JSON.stringify(graph, null, 2)}\n`;
}
