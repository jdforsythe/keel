import { parseTopology } from "@keel/compiler";
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
    .flatMap((m) => (m === undefined ? [] : [m]))
    .sort();

/** A command line (`keel` bare, for the Command form to spell) and the input it passes to `@keel/scaffold`. */
type Line = { readonly text: string; readonly op: Op; readonly input: Readonly<Record<string, unknown>> };

/** A need no line meets by adding to the project (k.scaffold-needs First): named in words, with its `see`. */
type Need = { readonly message: string; readonly see: "k.topology" };
const NO_CLIENT: { readonly need: Need } = {
  need: { message: "shell needs a client deployable, and this project has none", see: "k.topology" },
};

/** Whether `line`, run in the project of `files`, is not refused for a name the project already holds (E1351). */
const free = (line: Line, files: ReadonlyMap<string, string>): boolean => {
  const r = scaffold(line.op, line.input, files);
  return r.ok || r.error.data.code !== "E1351";
};

/** The first of `make("")`, `make("2")` ... `make("9")` whose name the project does not hold; `make("")` when all do. */
const firstFree = (make: (n: string) => Line, files: ReadonlyMap<string, string>): Line =>
  ["", "2", "3", "4", "5", "6", "7", "8", "9"].map(make).find((l) => free(l, files)) ?? make("");

/**
 * What `op` needs given its inputs (k.scaffold-needs), formed from the project in `files` so that it names only what
 * the project holds and, run as written, succeeds: `example`, a line that passes the inputs, or `first`, the line that
 * makes what the project lacks for it. A generator that takes a module id names the first module in sorted order
 * (`app` without one) and a new name it does not hold (`about`, else `about2`, ...); `transaction` that module's first
 * store, or `first` the line making one; `service` a `--reason` where its module's `client` deployable asks for one
 * (E1358); `shell` `--to` the first `client` deployable when there are several, or, with none, `need`: no line only
 * adds one, so the need is named in words with its section.
 */
const lineOf = (
  op: Op,
  files: ReadonlyMap<string, string>,
): { readonly example: Line } | { readonly first: Line } | { readonly need: Need } => {
  const mod = modulesOf(files)[0] ?? "app";
  const store = [...files.keys()]
    .map((p) =>
      p.startsWith(`modules/${mod}/`) ? /^[^/]+\/[^/]+\/([a-z][A-Za-z0-9]*)\.store\.ts$/.exec(p)?.[1] : undefined,
    )
    .flatMap((s) => (s === undefined ? [] : [s]))
    .sort()[0];
  const gen = (o: Op, args: string, input: Readonly<Record<string, unknown>>): Line => ({
    text: `keel scaffold ${o} ${args}`,
    op: o,
    input,
  });
  const mod2 = (o: Op, name: (n: string) => string, sep: string) =>
    firstFree((n) => gen(o, `${mod}${sep}${name(n)}`, { id: `${mod}${sep}${name(n)}` }), files);
  switch (op) {
    case "project":
      return { example: gen(op, "shop", { name: "shop" }) };
    case "module":
      return { example: firstFree((n) => gen(op, `orders${n}`, { id: `orders${n}` }), files) };
    case "route":
      return { example: mod2(op, (n) => `about${n}`, ".") };
    case "component":
      return { example: mod2(op, (n) => `OrderCard${n}`, "/") };
    case "store":
      return { example: mod2(op, (n) => `cart${n}`, ".") };
    case "transaction":
      return store === undefined
        ? { first: mod2("store", (n) => `cart${n}`, ".") }
        : { example: mod2(op, (n) => `${store}.addItem${n}`, ".") };
    case "service": {
      // A `client` deployable that lists the module and lacks the origin asks for a reason (E1358, k.scaffold-service).
      const probe = scaffold("service", { id: mod, base: "https://a.test" }, files);
      const reason = !probe.ok && probe.error.data.code === "E1358";
      const input = { id: mod, base: "https://a.test", ...(reason ? { reason: "geo" } : {}) };
      return { example: gen(op, `${mod} --base https://a.test${reason ? " --reason geo" : ""}`, input) };
    }
    case "shell": {
      const src = files.get("topology.ts");
      const topo = src === undefined ? undefined : parseTopology(src).topology;
      const clients = Object.entries(topo ?? {})
        .filter(([, d]) => d.adapter === "client")
        .map(([name]) => name)
        .sort();
      const shell = firstFree((n) => {
        const kind = n === "" ? "tauri" : "capacitor";
        const to = clients.length > 1 ? ` --to ${clients[0] ?? ""}` : "";
        const input = { shell: kind, id: "com.acme.shop", ...(to === "" ? {} : { to: clients[0] }) };
        return gen(op, `${kind} --id com.acme.shop${to}`, input);
      }, files);
      // No line only adds a `client` deployable (k.scaffold-needs First): with none, the need is named in words.
      const probe = scaffold(op, shell.input, files);
      return !probe.ok && probe.error.data.see === "k.topology" ? NO_CLIENT : { example: shell };
    }
    case "library":
      return { example: gen(op, "@acme/charts", { name: "@acme/charts" }) };
    case "rename":
      return { example: { text: "keel codemod rename OrderCard OrderTile", op, input: {} } };
    case "move":
      return { example: { text: "keel codemod move OrderCard --to catalog", op, input: {} } };
    case "place":
      return { example: { text: "keel codemod place digest --to jobs", op, input: {} } };
    case "add-field":
      return { example: { text: "keel codemod add-field Order note string", op, input: {} } };
  }
};

/**
 * The E1052 message for an input field `op` lacks (k.cli Rules): the argument or flag as written (`<id>`,
 * `--to <module>`) and a command line that passes it, formed from the project's own `files` (`lineOf`); `see` when
 * the message names a need no line meets, the section that explains it.
 */
export function missingInput(
  op: Op,
  field: string,
  files: ReadonlyMap<string, string> = new Map(),
): { readonly message: string; readonly see?: "k.topology" } {
  const shown = ARGS[op].includes(field) ? `<${field}>` : `--${field} <${VALUE[`${op}.${field}`] ?? field}>`;
  const line = lineOf(op, files);
  if ("need" in line) return line.need;
  if ("first" in line) return { message: `${op} needs a store first: ${line.first.text}` };
  return { message: `${op} needs ${shown}${op === "service" ? ":" : ", as in"} ${line.example.text}` };
}
