/** Ambient types of what a browser build promises (k.bundle Types): `import.meta.env` with k.boundary's five keys, and the `?worker`, `?sharedworker` and `?url` imports. */
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}
interface ImportMetaEnv {
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare module "*?worker" {
  const W: { new (options?: { name?: string }): Worker };
  export default W;
}
declare module "*?sharedworker" {
  const W: { new (options?: { name?: string }): SharedWorker };
  export default W;
}
declare module "*?url" {
  const src: string;
  export default src;
}
