/** Any value that survives JSON.stringify/JSON.parse unchanged. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
