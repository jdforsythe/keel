declare const params: unique symbol;

/**
 * An object message (std.messages): one template, plural forms chosen by a number param, or a case per value of an enum
 * param. `P` types the params `formatMessage` takes; a message is not a `Child`, so it renders only through it.
 */
export type Message<P = Readonly<Record<string, string | number>>> = (
  | { readonly text: string }
  | {
      readonly plural: string;
      readonly other: string;
      readonly zero?: string;
      readonly one?: string;
      readonly two?: string;
      readonly few?: string;
      readonly many?: string;
      readonly [exact: `=${number}`]: string;
    }
  | { readonly select: string; readonly cases: Readonly<Record<string, string>> }
) & { readonly [params]?: P };
