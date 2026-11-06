/** A node of the static reactive graph in `deps.json`. */
export type DepsNode = {
  file: string;
  id: string;
  kind: "signal" | "computed" | "resource" | "effect" | "prop" | "binding";
  name: string;
};
