import type { Computed } from "@keel/reactive";
import type { Children } from "../types/Children.ts";
import type { KeyInput } from "./KeyInput.ts";
import type { PartStyle } from "./PartStyle.ts";

/** A value, a signal or a computed. */
type V<T> = T | Computed<T>;

type Common = PartStyle & {
  readonly id: string;
  readonly lang?: string;
  readonly hidden?: V<boolean>;
  /** Never positive. */
  readonly tabIndex?: V<0 | -1>;
  /** Focuses the element when it turns from false to true; never at the first render or at resume. */
  readonly focus?: V<boolean>;
  /** Runs on `keydown`; returning true prevents the default. */
  readonly onKey?: (key: KeyInput) => boolean;
  readonly onClick?: () => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
};
type Kids = { readonly children?: Children };
/** Exactly one of `label` (written as `aria-label`) and `labelledBy` (an element id). */
type Named =
  | { readonly label: V<string>; readonly labelledBy?: never }
  | { readonly labelledBy: V<string>; readonly label?: never };
/** At most one of `label` and `labelledBy` (`treeitem`, named by its content otherwise). */
type MaybeNamed =
  | { readonly label?: V<string>; readonly labelledBy?: never }
  | { readonly labelledBy?: V<string>; readonly label?: never };
type Off = { readonly disabled?: V<boolean> };
type Orient = { readonly orientation?: V<"horizontal" | "vertical"> };
type Active = { readonly activeDescendant?: V<string> };
type Dialog = {
  readonly labelledBy: V<string>;
  readonly open: V<boolean>;
  readonly onDismiss?: () => void;
  /** The id of the element focus returns to on close (the trigger); gone, the element focused at open, else `main`. */
  readonly returnFocus?: V<string>;
};
type R<Role extends string, P = unknown> = Common & { readonly role: Role } & P;

/** `Part`'s props: a union discriminated by `role`, which fixes the tag and the ARIA props it accepts (k.aria Roles, k.roles). */
export type PartProps =
  | R<"listbox", Kids & Named & Orient & Active & { readonly multiselectable?: V<boolean> }>
  | R<"menu", Kids & Named & Orient & Active>
  | R<"option", Kids & Off & { readonly selected: V<boolean> }>
  | R<"menuitem", Kids & Off>
  | R<"menuitemcheckbox", Kids & Off & { readonly checked: V<boolean> }>
  | R<
      "combobox",
      Named &
        Active & {
          readonly expanded: V<boolean>;
          readonly controls: V<string>;
          readonly value?: V<string>;
          readonly onInput?: (value: string) => void;
        }
    >
  | R<
      "button",
      Kids &
        Off & {
          readonly controls?: V<string>;
          readonly hasPopup?: V<"menu" | "listbox" | "dialog">;
          readonly expanded?: V<boolean>;
        }
    >
  | R<"checkbox", Named & { readonly checked: V<boolean | "mixed"> }>
  | R<"tablist", Kids & Named & Orient>
  | R<"tab", Kids & { readonly selected: V<boolean>; readonly controls: V<string> }>
  | R<"tabpanel", Kids & { readonly labelledBy: V<string> }>
  | R<"dialog", Kids & Dialog & { readonly describedBy?: V<string> }>
  | R<"alertdialog", Kids & Dialog & { readonly describedBy: V<string> }>
  | R<"status", Kids>
  | R<"alert", Kids>
  | R<"generic", Kids>
  | R<"navigation", Kids & Named>
  | R<"group", Kids & Named & { /** Renders a `ul`, the children of a `treeitem`. */ readonly list?: boolean }>
  | R<"table", Kids & Named & { readonly rowCount?: V<number | undefined> }>
  | R<"rowgroup", Kids & { readonly head?: boolean }>
  | R<"row", Kids & { readonly rowIndex?: V<number | undefined> }>
  | R<
      "columnheader",
      Kids & {
        readonly sort?: V<"ascending" | "descending" | undefined>;
        /** The full name of a short header, written as the HTML `abbr`. */
        readonly abbr?: V<string>;
      }
    >
  | R<"rowheader", Kids>
  | R<"cell", Kids & { readonly colSpan?: V<number | undefined> }>
  | R<
      "grid",
      Kids &
        Named & {
          readonly rowCount?: V<number>;
          readonly colCount?: V<number>;
          readonly multiselectable?: V<boolean>;
          readonly readOnly?: V<boolean>;
        }
    >
  | R<
      "gridcell",
      Kids &
        Off & {
          readonly selected?: V<boolean>;
          readonly readOnly?: V<boolean>;
          readonly current?: V<"date" | boolean>;
          readonly colSpan?: V<number>;
        }
    >
  | R<
      "tree",
      Kids &
        Named &
        Active & {
          readonly multiselectable?: V<boolean>;
          /** A `treeitem`'s, never the tree's. */
          readonly expanded?: never;
        }
    >
  | R<
      "treeitem",
      Kids &
        MaybeNamed &
        Off & {
          /** Absent on a leaf. */
          readonly expanded?: V<boolean>;
          readonly selected?: V<boolean>;
          readonly level?: V<number>;
          readonly setSize?: V<number>;
          readonly posInSet?: V<number>;
        }
    >
  | R<
      "slider",
      Named &
        Off &
        Orient & {
          readonly min: V<number>;
          readonly max: V<number>;
          readonly value: V<number>;
          readonly step?: V<number>;
          readonly valueText?: V<string>;
          readonly onInput?: (value: number) => void;
        }
    >
  | R<"radiogroup", Kids & Named & { readonly required?: V<boolean> }>
  | R<
      "radio",
      Named &
        Off & {
          readonly name: V<string>;
          readonly checked: V<boolean>;
          readonly value?: V<string>;
          /** Called when the radio becomes checked. */
          readonly onChange?: () => void;
        }
    >;
