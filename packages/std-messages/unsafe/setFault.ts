import { unsafe } from "./unsafe.ts";

/** Throws the `Error` std.messages specifies: a refused `messages()` declaration, or a locale entry failing its set. */
export function setFault(message: string): never {
  return unsafe(
    "std.messages specifies a throw for a set declared with locales not an s.enum, a key or param name no identifier or a param of no kind, and for a locale entry failing its set, which throws however its file is imported and rejects load: the declaration and the locale files are the app's own source, so each fault is a bug there, surfacing at import as a module error does, never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
