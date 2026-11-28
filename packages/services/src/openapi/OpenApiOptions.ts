/** Options of `openapi`: `name` is the service name, lowerCamel (`/^[a-z][A-Za-z0-9]*$/`; else a `RangeError`), the module id under `keel scaffold service` by default; the declaration is exported as `<Name>Api`. */
export type OpenApiOptions = {
  readonly name: string;
};
