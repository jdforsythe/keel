import { type Op, scaffold } from "@keel/scaffold";

/** Each operation's positional arguments in order (`scaffoldInput`). */
const ARGS: Readonly<Record<Op, readonly string[]>> = {
  project: ["name"],
  module: ["id"],
  route: ["id"],
  component: ["id"],
  store: ["id"],
  transaction: ["id"],
  service: ["id"],
  shell: ["shell"],
  library: ["name"],
  rename: ["from", "to"],
  move: ["name"],
  place: ["module"],
  "add-field": ["schema", "field", "type"],
};
/** A flag's value as its help names it, where the field's name would not say it. */
const VALUE: Readonly<Record<string, string>> = { "move.to": "module", "place.to": "deployable" };

/** The module ids of `files` (`modules/<id>/module.ts`), sorted. */
const modulesOf = (files: ReadonlyMap<string, string>): string[] =>
  [...files.keys()]
    .map((p) => /^modules\/([^/]+)\/module\.ts$/.exec(p)?.[1])
    .filter((m): m is string => m !== undefined)
    .sort();

/**
 * A command line that passes `op`'s inputs (k.scaffold), formed from the project in `files` so that run as written it
 * succeeds: a generator that takes a module id names the first module in sorted order (`app` without one), a
 * transaction that module's first store (`cart` without one), a service a `--reason` where its module's `client`
 * deployable asks for one (E1358); `keel` left bare for the Command form to spell.
 */
const lineOf = (op: Op, files: ReadonlyMap<string, string>): string => {
  const mod = modulesOf(files)[0] ?? "app";
  const store =
    [...files.keys()]
      .map((p) =>
        p.startsWith(`modules/${mod}/`) ? /^[^/]+\/[^/]+\/([a-z][A-Za-z0-9]*)\.store\.ts$/.exec(p)?.[1] : undefined,
      )
      .filter((s): s is string => s !== undefined)
      .sort()[0] ?? "cart";
  // A `client` deployable that lists the module and lacks the origin asks for a reason (E1358, k.scaffold-service).
  const probe = op === "service" ? scaffold("service", { id: mod, base: "https://a.test" }, files) : undefined;
  const reason = probe !== undefined && !probe.ok && probe.error.data.code === "E1358";
  switch (op) {
    case "project":
      return "keel scaffold project shop";
    case "module":
      return "keel scaffold module orders";
    case "route":
      return `keel scaffold route ${mod}.about`;
    case "component":
      return `keel scaffold component ${mod}/OrderCard`;
    case "store":
      return `keel scaffold store ${mod}.cart`;
    case "transaction":
      return `keel scaffold transaction ${mod}.${store}.addItem`;
    case "service":
      return `keel scaffold service ${mod} --base https://a.test${reason ? " --reason geo" : ""}`;
    case "shell":
      return "keel scaffold shell tauri --id com.acme.shop";
    case "library":
      return "keel scaffold library @acme/charts";
    case "rename":
      return "keel codemod rename OrderCard OrderTile";
    case "move":
      return "keel codemod move OrderCard --to catalog";
    case "place":
      return "keel codemod place digest --to jobs";
    case "add-field":
      return "keel codemod add-field Order note string";
  }
};

/**
 * The E1052 message for an input field `op` lacks (k.cli Rules): the argument or flag as written (`<id>`,
 * `--to <module>`) and a command line that passes it, formed from the project's own `files` (`lineOf`).
 */
export function missingInput(op: Op, field: string, files: ReadonlyMap<string, string> = new Map()): string {
  const shown = ARGS[op].includes(field) ? `<${field}>` : `--${field} <${VALUE[`${op}.${field}`] ?? field}>`;
  return `${op} needs ${shown}${op === "service" ? ":" : ", as in"} ${lineOf(op, files)}`;
}
