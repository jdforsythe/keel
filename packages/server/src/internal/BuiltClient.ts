/**
 * A node deployable's client build as a production `createApp({ assets })` serves it (k.server Build, RFC 0048):
 * `entry`, the URL of the bundled resume entry the document's module script loads, and `files`, every built file by
 * URL path (`/assets/...` and the entry) with its content type.
 */
export type BuiltClient = {
  readonly entry: string;
  readonly files: ReadonlyMap<string, { readonly body: Uint8Array<ArrayBuffer>; readonly type: string }>;
};
