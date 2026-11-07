/**
 * The sources `openapi` generates: `schema` for `<Name>Api.schema.ts` (the `endpoints` declaration, exported as
 * `<Name>Api`) and `service` for `api.ts` (the `service`, importing `./<Name>Api.schema.ts`), rfc:0039.
 */
export type OpenApiFiles = {
  readonly schema: string;
  readonly service: string;
};
