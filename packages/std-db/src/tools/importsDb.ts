import { type Finding, type RuleDef, defineRule } from "@keel/check";

const DB = /^@keel\/std-db(\/|$)/;

/** 1-based line and column of offset `at` in `source`. */
const at = (source: string, offset: number): { line: number; col: number } => {
  const before = source.slice(0, offset);
  return { line: before.split("\n").length, col: offset - before.lastIndexOf("\n") };
};

/**
 * E2151 (std.db, k.check registry): an app file imports or re-exports `@keel/std-db` or one of its entries. Only the
 * generated entry opens a driver; app state reaches the database through stores and `ctx.storage`. No fix.
 */
export const importsDb: RuleDef = defineRule({
  code: "E2151",
  see: "std.db",
  message: "app code imports @keel/std-db; only the generated entry opens a driver",
  explain:
    "The generated entry opens the database that topology.ts names; app state reaches it only through stores and " +
    "ctx.storage. Fix: remove the import and set storage: 'sqlite' or 'postgres' on the deployable in topology.ts.",
  check: ({ file, ast }): Finding[] => {
    const out: Finding[] = [];
    for (const st of ast.body) {
      const from =
        st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration"
          ? st.source
          : null;
      if (from !== null && DB.test(from.value)) out.push({ path: file.path, ...at(file.source, from.start) });
    }
    return out;
  },
});
