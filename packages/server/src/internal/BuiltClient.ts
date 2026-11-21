/**
 * A node deployable's client build as a production `createApp({ assets })` serves it (k.server Build): `entry`, the URL
 * of the bundled resume entry the document's module script loads; `css`, the URLs of the stylesheets the manifest's
 * entry chunk names, which every document links; and `files`, every served file by decoded URL path with its content
 * type, whether its name is a content hash the manifest records (`immutable`; else it is served `no-cache`), and its
 * weak `etag`. `index` is the hosted `client` deployable's `index.html` (k.hosting Host) and the policy it is served
 * with: `cspPolicy` of the origins of its `keel-peer` tags (k.security Other deployables) and of that deployable's
 * declared origins (k.origins); else undefined.
 */
export type BuiltClient = {
  readonly entry: string;
  readonly css: readonly string[];
  readonly index?: { readonly body: Uint8Array<ArrayBuffer>; readonly policy: string } | undefined;
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
