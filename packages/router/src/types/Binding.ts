import type { Ctx } from "@keel/ctx";
import type { Infer, KeelError, Schema } from "@keel/schema";
import type { Action } from "./Action.ts";
import type { ApiAction } from "./ApiAction.ts";
import type { ApiGuard } from "./ApiGuard.ts";
import type { Guard } from "./Guard.ts";
import type { Loader } from "./Loader.ts";
import type { RouteProps } from "./RouteProps.ts";

type None = Record<string, never>;
type InferOr<E, K extends string> = E extends { readonly [P in K]: infer S } ? Infer<S> : None;
type LayoutIds<C> = { [L in keyof C & string]: C[L] extends { readonly layout: true } ? L : never }[keyof C & string];
type IdChar =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "-";
/**
 * A route id `<module>.<name>` whose module is not `M`, spelled as template literals that leave `M`'s prefix out: at
 * each position a character other than `M`'s, a shorter module ending there, or a longer one past `M`'s end. So
 * `'al.layout'` fits module `ap` and `'ap.layuot'` does not; which ids the other contract holds is `routeTable`'s check.
 */
type Foreign<M extends string, At extends string = ""> = string extends M
  ? `${string}.${string}`
  : M extends `${infer H}${infer T}`
    ?
        | `${At}${Exclude<IdChar, H>}${string}.${string}`
        | (At extends "" ? never : `${At}.${string}`)
        | Foreign<T, `${At}${H}`>
    : `${At}${IdChar}${string}.${string}`;
/** What a binding's `layout` takes in module `M`: a layout id of its contract, exact, or a layout of another module's. */
type LayoutOf<C, M extends string> = LayoutIds<C> | Foreign<M>;
type ErrorProps = { readonly error: KeelError<string, unknown> };

type PageBind<C, M extends string, K extends string> = {
  component(props: RouteProps, ctx: Ctx): Node;
  readonly loader?: Loader<K, unknown, false>;
  readonly guard?: Guard;
  readonly layout?: LayoutOf<C, M>;
  errorElement?(props: ErrorProps, ctx: Ctx): Node;
  readonly POST?: Action<K>;
  readonly PUT?: Action<K>;
  readonly PATCH?: Action<K>;
  readonly DELETE?: Action<K>;
};
type LayoutBind<C, M extends string, K extends string> = {
  component(props: RouteProps, ctx: Ctx): Node;
  readonly loader?: Loader<K, unknown, false>;
  readonly guard?: Guard;
  readonly layout?: LayoutOf<C, M>;
  errorElement?(props: ErrorProps, ctx: Ctx): Node;
};
type GetBind<E, K extends string> = {
  readonly loader: Loader<K, unknown, E extends { readonly events: true } ? true : false>;
  readonly guard?: ApiGuard;
};
type WriteBind<K extends string> = { readonly action: ApiAction<K>; readonly guard?: ApiGuard };
type BindOf<C, M extends string, K extends keyof C & string> = C[K] extends { readonly method: "GET" }
  ? GetBind<C[K], K>
  : C[K] extends { readonly method: unknown }
    ? WriteBind<K>
    : C[K] extends { readonly layout: true }
      ? LayoutBind<C, M, K>
      : PageBind<C, M, K>;

/**
 * What a page's `title` gets (k.head): its parsed `params` and `search`, and its loader's `ok` value as `data`.
 */
type TitleProps<E, T> = {
  readonly params: InferOr<E, "params">;
  readonly search: InferOr<E, "search">;
  readonly data: T;
};
type Titled<C, O> = {
  readonly [K in keyof O]: K extends keyof C
    ? C[K] extends { readonly method: unknown } | { readonly layout: true }
      ? unknown
      : { readonly loader?: { readonly output: Schema<O[K], boolean> }; title?(props: TitleProps<C[K], O[K]>): string }
    : never;
};

/**
 * The binding `manifest(contract, binding)` takes (k.contract Binding): a mapped type keyed by the contract's ids, so
 * an unbound entry fails at the argument, an extra key at the key, a refused member at the member, a handler declared
 * for another id at its member and a wrong `layout` at `layout` (k.routes Where rules fire). `O` is each page's loader
 * value, inferred from the binding, which types its `title`. `M` is the module id: `layout` takes the contract's
 * layout ids exactly, or an id of another module's contract (`Foreign`), resolved where tables join. A contract whose ids are computed (`string` keys) has
 * its binding checked at run time only.
 */
export type Binding<C, O, M extends string = string> = string extends keyof C
  ? Readonly<Record<string, unknown>>
  : { readonly [K in keyof C & string]: BindOf<C, M, K> } & Titled<C, O>;
