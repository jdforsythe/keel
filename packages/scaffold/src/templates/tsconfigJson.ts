/** `tsconfig.json` of a new project: extends the Keel strict profile. */
export function tsconfigJson(): string {
  const cfg = {
    extends: "@keel/compiler/tsconfig.strict.json",
    include: ["tokens.ts", "topology.ts", "vite.config.ts", "modules"],
  };
  return `${JSON.stringify(cfg, null, 2)}\n`;
}
