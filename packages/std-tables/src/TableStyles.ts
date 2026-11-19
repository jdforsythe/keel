import type { StyleProps } from "@keel/ui";
import type { PartStyle } from "@keel/ui/aria";

/** A `DataTable`'s `styles`, by part. */
export type TableStyles = {
  readonly table?: PartStyle;
  readonly head?: PartStyle;
  readonly body?: PartStyle;
  readonly header?: PartStyle;
  readonly row?: PartStyle;
  readonly cell?: PartStyle;
  readonly select?: PartStyle;
  readonly selectAll?: PartStyle;
  readonly pager?: PartStyle;
  readonly status?: PartStyle;
  readonly sort?: StyleProps;
  readonly previous?: StyleProps;
  readonly next?: StyleProps;
};
