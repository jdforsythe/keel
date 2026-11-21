import { hostCode } from "@keel/ui";

// A host element code file that must never load: the harness and a replay run without the outside library (k.host-element).
// Importing it throws; if it were somehow imported, `mount` throws too, so neither load nor run goes unnoticed.
throw new Error("host element code was imported");

export const neverLoaded = hostCode<{ n: number }, { at: number }>({
  mount: () => {
    throw new Error("host element code was mounted");
  },
});
