import { notCompiled } from "./notCompiled.ts";

/** The automatic JSX runtime's call for static children; throws (`notCompiled`), as `jsx` does. */
export function jsxs(_type: unknown, _props: unknown, _key?: unknown): never {
  return notCompiled();
}
