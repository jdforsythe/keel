/** An `Intl` constructor or `toLocale*String`/`localeCompare` call given a locale (E2301): what it is, what to call. */
export type LocaleCall = {
  readonly start: number;
  readonly what: string;
  readonly use: string;
};
