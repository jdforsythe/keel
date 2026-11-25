import { notCompiled } from "./notCompiled.ts";

/** The automatic JSX runtime's element call; throws (`notCompiled`): the Keel compiler lowers JSX to runtime ops. */
export function jsx(_type: unknown, _props: unknown, _key?: unknown): never {
  return notCompiled();
}
