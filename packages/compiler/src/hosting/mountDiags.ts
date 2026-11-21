import path from "node:path";
import { Visitor, parseSync } from "oxc-parser";
import { lineCol } from "../internal/lineCol.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { identitySource } from "./identitySource.ts";
import { mountSource } from "./mountSource.ts";

/** A subpath `identityMount(path).href` takes: `''` or `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`. */
const SUBPATH = /^(\/(?!\.\.?(\/|$))[\w.~-]+)*$/;

/**
 * k.mount Rules of a project (paths relative to it), when it has an `identity.ts`. E1580: `identity.ts` whose default
 * export is not `identityMount('<literal>')` of lowercase `/` segments (`mountSource`), or no `identity.server.ts`
 * whose `handle.path` is `<its default import>.path` (`identitySource`). E1581: a file under `modules/<id>/`
 * importing `identity.ts` where a deployable of `topology.ts` serving `<id>` is `static`, or `client` without
 * `servedBy`: no origin serving it mounts `handle`. E1582: `<default import>.href('<literal>')` whose subpath
 * `href` refuses. E1584: a `links` entry of `identity.ts` that is not a string literal, is `''`, is not of the subpath
 * form, or repeats one (`mountSource`), at the entry. No fix.
 */
export function mountDiags(files: readonly SourceFile[]): Diagnostic[] {
  const own = files.find((f) => f.path === "identity.ts");
  if (own === undefined) return [];
  const server = files.find((f) => f.path === "identity.server.ts");
  const read = mountSource(own.source);
  const problem =
    read.problem ??
    (server !== undefined && identitySource(server.source).mounted
      ? undefined
      : "identity.server.ts needs handle: { path: mount.path }, mount its default import of ./identity.ts");
  const out: Diagnostic[] =
    problem === undefined ? [] : [{ code: "E1580", path: own.path, line: 1, col: 1, message: problem, see: "k.mount" }];
  for (const l of read.links ?? [])
    out.push({ code: "E1584", path: own.path, ...lineCol(own.source, l.offset), message: l.message, see: "k.mount" });
  const top = files.find((f) => f.path === "topology.ts");
  const deployables = Object.entries(top === undefined ? {} : parseTopology(top.source).topology);
  for (const f of files) {
    if (!/\.tsx?$/.test(f.path) || !f.source.includes("identity")) continue;
    const { program } = parseSync(f.path, f.source, {
      sourceType: "module",
      lang: f.path.endsWith("x") ? "tsx" : "ts",
    });
    const imports = program.body.flatMap((s) =>
      s.type === "ImportDeclaration" &&
      path.posix.join(path.posix.dirname(f.path), s.source.value).replace(/(\.ts)?$/, ".ts") === own.path
        ? [s]
        : [],
    );
    const [first] = imports;
    if (first === undefined) continue;
    const at = (code: string, offset: number, message: string): void =>
      void out.push({ code, path: f.path, ...lineCol(f.source, offset), message, see: "k.mount" });
    const id = /^modules\/([^/]+)\//.exec(f.path)?.[1];
    const bare = deployables.find(
      ([, d]) =>
        id !== undefined &&
        d.modules.includes(id) &&
        (d.adapter === "static" || (d.adapter === "client" && d.servedBy === undefined)),
    );
    if (bare !== undefined)
      at("E1581", first.start, `${bare[0]} (${bare[1].adapter}) serves module ${id}, whose origin mounts no handle`);
    const names = imports.flatMap((s) =>
      s.specifiers.flatMap((x) => (x.type === "ImportDefaultSpecifier" ? [x.local.name] : [])),
    );
    new Visitor({
      CallExpression: (c) => {
        const { callee } = c;
        const sub = c.arguments[0];
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          names.includes(callee.object.name) &&
          callee.property.name === "href" &&
          sub?.type === "Literal" &&
          typeof sub.value === "string" &&
          !SUBPATH.test(sub.value)
        )
          at(
            "E1582",
            c.start,
            `href(${JSON.stringify(sub.value).slice(0, 30)}): not '' or / segments of [A-Za-z0-9._~-]`,
          );
      },
    }).visit(program);
  }
  return out;
}
