/** The text of each CLDR plural category (std.i18n); `other` is required and is the fallback for a missing form. */
export type PluralForms = {
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
};
