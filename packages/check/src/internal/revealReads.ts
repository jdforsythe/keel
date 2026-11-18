import { globalRefs, references, unwrapExpression } from "@keel/compiler/internal";
import { type Expression, type Program, type VariableDeclarator, Visitor } from "oxc-parser";
import { memberName } from "./memberName.ts";
import { localNames } from "./modules/localNames.ts";

/** A name bound to `reveal`, at the offset of its declaration (an import binds at the program start). */
type Site = { readonly name: string; readonly at: number };

/**
 * Offsets in `program` that read `reveal` from `@keel/schema`: an imported name, a `const` alias of one at any
 * chain length (`const r = reveal`, `const { reveal: r } = K`), or `K.reveal`/`K['reveal']` on a namespace import.
 * Each name counts only where it binds that import or alias (a local of the same name shadows it).
 */
export function revealReads(program: Program): number[] {
  const g = globalRefs(program);
  const sites: Site[] = [...localNames(program, "reveal", "@keel/schema")].map((name) => ({ name, at: program.start }));
  const namespaces = new Set<string>();
  for (const st of program.body)
    if (st.type === "ImportDeclaration" && st.source.value === "@keel/schema")
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
  const namespace = (e: Expression): boolean =>
    e.type === "Identifier" && namespaces.has(e.name) && g.sameBinding(e.name, program.start, e.start);
  const isSite = (name: string, at: number): boolean =>
    sites.some((s) => s.name === name && g.sameBinding(name, s.at, at));
  const isReveal = (e: Expression): boolean => {
    const x = unwrapExpression(e);
    if (x.type === "Identifier") return isSite(x.name, x.start);
    return x.type === "MemberExpression" && memberName(x) === "reveal" && namespace(unwrapExpression(x.object));
  };
  const members: number[] = [];
  const consts: VariableDeclarator[] = [];
  new Visitor({
    VariableDeclaration: (n) => {
      if (n.kind === "const") consts.push(...n.declarations);
    },
    MemberExpression: (n) => {
      if (isReveal(n)) members.push(n.start);
    },
  }).visit(program);
  // Aliases of aliases: repeat until a pass adds no name.
  for (let added = true; added; ) {
    added = false;
    for (const d of consts) {
      const init = d.init;
      if (init === null || init === undefined) continue;
      const found: Site[] = [];
      if (d.id.type === "Identifier" && isReveal(init)) found.push({ name: d.id.name, at: d.id.start });
      else if (d.id.type === "ObjectPattern" && namespace(unwrapExpression(init)))
        for (const p of d.id.properties) {
          if (p.type === "RestElement" || p.computed || p.value.type !== "Identifier") continue;
          const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : null;
          if (key === "reveal") found.push({ name: p.value.name, at: p.value.start });
        }
      for (const s of found)
        if (!sites.some((t) => t.name === s.name && t.at === s.at)) {
          sites.push(s);
          added = true;
        }
    }
  }
  const named = references(program)
    .refs.filter((r) => isSite(r.name, r.start))
    .map((r) => r.start);
  return [...named, ...members];
}
