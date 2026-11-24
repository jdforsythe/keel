import type { StyleProps } from "@keel/ui";
import type { PartStyle } from "@keel/ui/aria";

/** The shown columns; any name when none are known to the type (a table type read without its columns). */
type Shown<C extends string> = [C] extends [never] ? string : C;

/**
 * A `DataTable`'s `styles`, by part. `column.<col>` styles that shown column's header and cells, after `header` and
 * `cell`, so it wins per prop.
 */
export type TableStyles<C extends string = string> = {
  readonly [K in `column.${Shown<C>}`]?: PartStyle;
} & {
  readonly scroll?: StyleProps;
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
