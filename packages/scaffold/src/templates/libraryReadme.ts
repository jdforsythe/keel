/** `README.md` of a library: its name, how an app lists it, and the commands that check, test and pack it. */
export function libraryReadme(name: string, id: string): string {
  return [
    `# ${name}`,
    "",
    `A Keel library. An app lists it in a module's \`deps\` (\`deps: ["${name}"]\`) and renders \`<Example id="<module>.<name>" />\`; the app's \`keel check\` checks this library's files with its own. Its module id is \`${id}\`.`,
    "",
    "- `keel check` and `keel test` judge the library in this folder, against `tokens.ts`.",
    "- `keel test --e2e` serves each component of `test/*.e2e.ts` in a browser from a `.keel/e2e-host-<random>/` folder per call, which git ignores.",
    "- `keel pack` checks, tests and writes `.keel/ledger.json`; commit it.",
    "- `pnpm pack` and `pnpm publish` build `dist/` and run `keel pack --check` first.",
    "",
  ].join("\n");
}
