/** Accepted inputs of `decodeStrings`: URL and form data, or a plain map of strings. */
export type StringInput = FormData | URLSearchParams | Record<string, string | string[]>;
