/** `src/index.ts` of a library: its entry, re-exporting the component its manifest makes public. */
export function libraryIndexTs(): string {
  return `export { default as Example } from "./Example.tsx";\n`;
}
