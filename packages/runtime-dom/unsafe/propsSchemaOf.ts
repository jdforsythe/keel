import { unsafe } from "./unsafe.ts";

type PropsSchema = { parse(json: unknown): { ok: true; value: unknown } | { ok: false } };

/** An island component's `Props` schema when it is a function with a `Props` object holding a `parse` function. */
export function propsSchemaOf(c: unknown): PropsSchema | undefined {
  if (typeof c !== "function" || !("Props" in c) || typeof c.Props !== "object" || c.Props === null) return undefined;
  const props = c.Props;
  if (!("parse" in props) || typeof props.parse !== "function") return undefined;
  return unsafe(
    "an island component's Props is the k.schema object schema declared for its props, whose parse takes the serialized json and returns a Result with ok and value",
    () => props as PropsSchema,
  );
}
