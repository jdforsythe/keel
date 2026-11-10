import { type Schema, s } from "@keel/schema";
import type { Locale } from "@keel/std-i18n";
import { asEntry } from "../unsafe/asEntry.ts";
import type { MessageSet } from "./MessageSet.ts";
import type { Entry } from "./internal/Entry.ts";
import type { Keys } from "./internal/Keys.ts";
import type { ParamKind } from "./internal/ParamKind.ts";
import { genMessage } from "./internal/genMessage.ts";
import { kindOf } from "./internal/kindOf.ts";
import { messageOk } from "./internal/messageOk.ts";
import { templateOk } from "./internal/templateOk.ts";

const IDENT = /^[A-Za-z_$][\w$]*$/;
const PARTS = s.array(s.string());

function messageType(params: ReadonlyMap<string, ParamKind>): Schema<unknown> {
  if (params.size === 0)
    return s.format("message", s.string(), {
      check: (v) => templateOk(v, []),
      gen: { from: s.string(), map: (v) => v.replace(/[{}]/g, "").slice(0, 60) || "x" },
    });
  return s.format(`message(${[...params.keys()].join(", ")})`, s.json(), {
    check: (v) => messageOk(v, params),
    gen: { from: PARTS, map: (parts) => genMessage(parts, params) },
  });
}

/**
 * Declare a message set (std.messages) in a `*.schema.ts` file: the app's `locales` enum, each key's params
 * (`s.string()`, `line`, `para`, `s.int()`, `s.number()` or `s.enum()`; any other throws) and
 * ``(locale) => import(`./<Set>/${locale}.ts`)``. The set is the closed object schema of one locale's entry.
 */
export function messages<L extends Locale, const K extends Keys>(
  locales: Schema<L>,
  keys: K,
  load: (locale: L) => Promise<unknown>,
): MessageSet<L, K> {
  if (locales.node.kind !== "enum") throw new Error("messages: locales is not an s.enum");
  const shape: Record<string, Schema<unknown>> = {};
  for (const [key, params] of Object.entries(keys)) {
    if (!IDENT.test(key)) throw new Error(`messages: bad key '${key}'`);
    const kinds = new Map<string, ParamKind>();
    for (const [name, schema] of Object.entries(params)) {
      const kind = IDENT.test(name) ? kindOf(schema) : undefined;
      if (kind === undefined) throw new Error(`messages: bad param '${name}' of '${key}'`);
      kinds.set(name, kind);
    }
    shape[key] = messageType(kinds);
  }
  const set = asEntry<MessageSet<L, K>>(s.object(shape, { closed: true }));
  return {
    ...set,
    text: (entry) => asEntry<Entry<K>>(entry),
    load: async (locale) => {
      const file: unknown = await load(locale);
      const entry = typeof file === "object" && file !== null && "default" in file ? file.default : undefined;
      const r = set.parse(entry);
      if (r.ok) return r.value;
      throw new Error(`messages: ${locale} entry fails: ${JSON.stringify(r.error.data.issues)}`);
    },
  };
}
