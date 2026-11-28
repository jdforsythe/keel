/**
 * The text of each CLDR plural category (std.i18n) and of exact numbers: `other` is required and is the fallback for a
 * missing form; `'=n'` (`n` a non-negative safe integer, as `'=0'`) applies when the number is `n`.
 */
export type PluralForms = {
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly [exact: `=${number}`]: string;
};
