/**
 * A node deployable's client build as a production `createApp({ assets })` serves it (k.server Build, RFC 0048, 0057):
 * `entry`, the URL of the bundled resume entry the document's module script loads, and `files`, every regular file
 * under `assets/` by decoded URL path with its content type, whether its name is a content hash the manifest records
 * (`immutable`; else it is served `no-cache`), and its weak `etag`.
 */
export type BuiltClient = {
  readonly entry: string;
  readonly files: ReadonlyMap<
    string,
    {
      readonly body: Uint8Array<ArrayBuffer>;
      readonly type: string;
      readonly immutable: boolean;
      readonly etag: string;
    }
  >;
};
