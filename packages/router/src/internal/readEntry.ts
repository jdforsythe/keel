import type { ObjectSchema } from "@keel/schema";
import type { EntryShape } from "./EntryShape.ts";
import { codedError } from "./codedError.ts";
import { compilePath } from "./compilePath.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { isMethod } from "./isMethod.ts";
import { isObjectSchema } from "./isObjectSchema.ts";
import { isSchema } from "./isSchema.ts";
import { ownValue } from "./ownValue.ts";
import { refuseSecret } from "./refuseSecret.ts";

const PAGE = ["path", "params", "search"];
const API = ["method", "path", "params", "query", "body", "output", "errors", "timeout", "events"];
const NAME = /^[a-z][A-Za-z0-9]*$/;

const refused = (id: string, keys: readonly string[], row: readonly string[], kind: string): void => {
  const bad = keys.find((k) => !row.includes(k));
  if (bad !== undefined) throw codedError("E1510", `${id}: a ${kind} entry takes no "${bad}"`);
};
const objectSchema = (id: string, e: object, k: string): ObjectSchema<unknown> | undefined => {
  const v = ownValue(e, k);
  if (v === undefined || isObjectSchema(v)) return v;
  throw codedError("E1510", `${id}: "${k}" is no object schema`);
};

/**
 * Read and check entry `id` of module `module`'s contract (k.contract, k.routes). Throws an Error with `code`: E1510
 * an entry of no kind or with a member its kind refuses; E1513 an API id whose name after the module is not one
 * lowerCamel segment; E1503 a `:name` in `path` without a `params` field, or the reverse, or a malformed path;
 * E1504 a required field in a page's `search`; E1653 a `body` on a GET; E1113 an API `output` holding `s.secret`.
 */
export function readEntry(module: string, id: string, e: unknown): EntryShape {
  if (typeof e !== "object" || e === null) throw codedError("E1510", `${id}: an entry is an object`);
  const keys = Object.keys(e);
  const path = ownValue(e, "path");
  let shape: EntryShape;
  if (Object.hasOwn(e, "method")) {
    const method = ownValue(e, "method");
    const output = ownValue(e, "output");
    if (!isMethod(method))
      throw codedError("E1510", `${id}: method ${String(method)} is not GET, POST, PUT, PATCH or DELETE`);
    if (typeof path !== "string") throw codedError("E1510", `${id}: an API entry needs a path`);
    if (!isSchema(output)) throw codedError("E1510", `${id}: an API entry needs an output schema`);
    refused(id, keys, API, "API");
    const name = id.startsWith(`${module}.`) ? id.slice(module.length + 1) : null;
    if (name !== null && !NAME.test(name))
      throw codedError("E1513", `${id}: an API id is ${module}.<name>, name one lowerCamel segment`);
    const params = objectSchema(id, e, "params");
    const query = objectSchema(id, e, "query");
    const body = objectSchema(id, e, "body");
    const errors = ownValue(e, "errors");
    const timeout = ownValue(e, "timeout");
    const events = ownValue(e, "events");
    if (
      errors !== undefined &&
      (typeof errors !== "object" || errors === null || !Object.values(errors).every(isSchema))
    )
      throw codedError("E1510", `${id}: "errors" maps a status to a schema`);
    if (timeout !== undefined && typeof timeout !== "number") throw codedError("E1510", `${id}: "timeout" is ms`);
    if (events !== undefined && typeof events !== "boolean") throw codedError("E1510", `${id}: "events" is a boolean`);
    if (method === "GET" && body !== undefined) throw codedError("E1653", `${id}: a GET entry has no body`);
    refuseSecret(output);
    shape = {
      id,
      module,
      kind: "api",
      path,
      segments: compilePath(id, path),
      method,
      output,
      ...(params === undefined ? {} : { params }),
      ...(query === undefined ? {} : { query }),
      ...(body === undefined ? {} : { body }),
      ...(errors === undefined
        ? {}
        : { errors: Object.fromEntries(Object.entries(errors).filter(([, v]) => isSchema(v))) }),
      ...(timeout === undefined ? {} : { timeout }),
      ...(events === undefined ? {} : { events }),
    };
  } else if (Object.hasOwn(e, "layout")) {
    if (ownValue(e, "layout") !== true) throw codedError("E1510", `${id}: a layout entry is { layout: true }`);
    refused(id, keys, ["layout"], "layout");
    return { id, module, kind: "layout", segments: null };
  } else if (typeof path === "string") {
    refused(id, keys, PAGE, "page");
    const params = objectSchema(id, e, "params");
    const search = objectSchema(id, e, "search");
    if (search !== undefined)
      for (const [k, node] of fieldsOf(search.node))
        if (node.kind !== "optional") throw codedError("E1504", `${id}: search field "${k}" must be optional`);
    shape = {
      id,
      module,
      kind: "page",
      path,
      segments: compilePath(id, path),
      ...(params === undefined ? {} : { params }),
      ...(search === undefined ? {} : { search }),
    };
  } else
    throw codedError(
      "E1510",
      `${id}: an entry is a page { path }, a layout { layout: true } or an API entry { method, path, output }`,
    );
  const names = (shape.segments ?? []).flatMap((s) => (s.kind === "param" ? [s.name] : []));
  const fields = shape.params === undefined ? [] : fieldsOf(shape.params.node).map(([k]) => k);
  for (const n of names) if (!fields.includes(n)) throw codedError("E1503", `${id}: ":${n}" has no params field`);
  for (const f of fields) if (!names.includes(f)) throw codedError("E1503", `${id}: params field "${f}" not in path`);
  return shape;
}
