import type { Op } from "@keel/scaffold";

/** Each operation's positional arguments in order (`scaffoldInput`) and a command line that passes them (k.scaffold). */
const FORMS: Readonly<Record<Op, { readonly args: readonly string[]; readonly line: string }>> = {
  project: { args: ["name"], line: "keel scaffold project shop" },
  module: { args: ["id"], line: "keel scaffold module orders" },
  route: { args: ["id"], line: "keel scaffold route orders.about" },
  component: { args: ["id"], line: "keel scaffold component orders/OrderCard" },
  store: { args: ["id"], line: "keel scaffold store orders.cart" },
  transaction: { args: ["id"], line: "keel scaffold transaction orders.cart.addItem" },
  service: { args: ["id"], line: "keel scaffold service geo --openapi api.json" },
  shell: { args: ["shell"], line: "keel scaffold shell tauri --id com.acme.shop" },
  library: { args: ["name"], line: "keel scaffold library @acme/charts" },
  rename: { args: ["from", "to"], line: "keel codemod rename OrderCard OrderTile" },
  move: { args: ["name"], line: "keel codemod move OrderCard --to catalog" },
  place: { args: ["module"], line: "keel codemod place digest --to jobs" },
  "add-field": { args: ["schema", "field", "type"], line: "keel codemod add-field Order note string" },
};
/** A flag's value as its help names it, where the field's name would not say it. */
const VALUE: Readonly<Record<string, string>> = { "move.to": "module", "place.to": "deployable" };

/**
 * The E1052 message for an input field `op` lacks (k.cli Rules): the argument or flag as written (`<id>`,
 * `--to <module>`) and a command line that passes it, `keel` left bare for the Command form to spell.
 */
export function missingInput(op: Op, field: string): string {
  const form = FORMS[op];
  const shown = form.args.includes(field) ? `<${field}>` : `--${field} <${VALUE[`${op}.${field}`] ?? field}>`;
  return `${op} needs ${shown}, as in ${form.line}`;
}
