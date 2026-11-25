import { notCompiled } from "./notCompiled.ts";

/** The automatic JSX runtime's fragment; throws when rendered (`notCompiled`), as `jsx` does. */
export function Fragment(_props: unknown): never {
  return notCompiled();
}
