import { type Schema, defect, s } from "@keel/schema";
import type { Locale } from "@keel/std-i18n";
import { asEntry } from "../unsafe/asEntry.ts";
import type { MessageSet } from "./MessageSet.ts";
import type { Keys } from "./internal/Keys.ts";
import { PARTS } from "./internal/PARTS.schema.ts";
import type { ParamKind } from "./internal/ParamKind.ts";
import { genMessage } from "./internal/genMessage.ts";
import { kindOf } from "./internal/kindOf.ts";
import { messageOk } from "./internal/messageOk.ts";
import { refused } from "./internal/refused.ts";
import { templateOk } from "./internal/templateOk.ts";

const IDENT = /^[A-Za-z_$][\w$]*$/;
const BLANK = /^\p{White_Space}*$/u;

function messageType(params: ReadonlyMap<string, ParamKind>): Schema<unknown> {
  if (params.size === 0)
    return s.format("message", s.string(), {
      check: (v) => templateOk(v, []) && !BLANK.test(v),
      gen: {
        from: s.string(),
        map: (v) => {
          const t = v.replace(/[{}]/g, "").slice(0, 60);
          return BLANK.test(t) ? `${t}x` : t;
        },
      },
    });
  return s.format(`message(${[...params.keys()]})`, s.json(), {
    check: (v) => messageOk(v, params),
    gen: { from: PARTS, map: (parts) => genMessage(parts, params) },
  });
}

/**
 * Declare a message set (std.messages) in a `*.schema.ts` file: the app's `locales` enum, each key's params
 * (`s.string()`, `line`, `para`, `s.int()`, `s.number()` or `s.enum()`; any other throws) and
 * ``(locale) => import(`./<Set>/${locale}.ts`)``. The set is the closed object schema of one locale's entry; `text`
 * parses a locale file's entry with it and throws `load`'s rejection for one that fails.
 */
export function messages<L extends Locale, const K extends Keys>(
  locales: Schema<L>,
  keys: K,
  load: (locale: L) => Promise<unknown>,
): MessageSet<L, K> {
  if (locales.node.kind !== "enum") return defect("messages: locales not an s.enum");
  const shape: Record<string, Schema<unknown>> = {};
  for (const [key, params] of Object.entries(keys)) {
    if (!IDENT.test(key)) return defect("messages: a key is no identifier", { data: { key } });
    const kinds = new Map<string, ParamKind>();
    for (const [name, schema] of Object.entries(params)) {
      const kind = IDENT.test(name) ? kindOf(schema) : undefined;
      if (kind === undefined)
        return defect("messages: a param is no identifier or of no kind", { data: { key, param: name } });
      kinds.set(name, kind);
    }
    shape[key] = messageType(kinds);
  }
  const set = asEntry<MessageSet<L, K>>(s.object(shape, { closed: true }));
  return {
    ...set,
    // A locale file's default export: parsed here, so a file failing the set throws however it is imported.
    text: (entry) => {
      const r = set.parse(entry);
      return r.ok ? r.value : refused(r.error);
    },
    load: async (locale) => {
      // The locale is parsed before `load` runs, so no value outside the set's enum reaches the dynamic import.
      const tag = locales.parse(locale);
      if (!tag.ok) return refused(tag.error);
      const file: unknown = await load(tag.value);
      const entry = typeof file === "object" && file !== null && "default" in file ? file.default : undefined;
      const r = set.parse(entry);
      return r.ok ? r.value : refused(r.error);
    },
  };
}
