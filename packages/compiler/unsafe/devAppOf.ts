import { unsafe } from "./unsafe.ts";

/** A `keel dev` app: a deployable's name, its `createApp` app, which paths it serves, and its mount. */
type DevApp = {
  readonly name: string;
  readonly app: { fetch(req: Request): Promise<Response>; close(): Promise<void> };
  served(path: string): boolean;
  readonly mount: string | undefined;
};

/** One entry of the dev entry's `apps` export as a dev app, or `undefined` for a value of another shape. */
export function devAppOf(v: unknown): DevApp | undefined {
  if (
    !Array.isArray(v) ||
    typeof v[0] !== "string" ||
    typeof v[2] !== "function" ||
    !(v[3] === undefined || typeof v[3] === "string") ||
    typeof v[1] !== "object" ||
    v[1] === null ||
    typeof Reflect.get(v[1], "fetch") !== "function" ||
    typeof Reflect.get(v[1], "close") !== "function"
  )
    return undefined;
  return unsafe(
    "devEntryCode writes each apps entry as [name, createApp result, served, mount], served a (path) => boolean, so the tuple has these types",
    () => {
      const [name, app, served, mount] = v as [string, DevApp["app"], DevApp["served"], DevApp["mount"]];
      return { name, app, served, mount };
    },
  );
}
