import type { Named } from "./Named.ts";

/** The `label` or `labelledBy` of a widget's props, for the part it names. */
export function nameOf(props: Named): Named {
  return props.label !== undefined ? { label: props.label } : { labelledBy: props.labelledBy };
}
