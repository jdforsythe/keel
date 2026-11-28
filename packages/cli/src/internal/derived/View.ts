/** One derived file to keep on disk (k.derived Refresh): its path under the cwd, its bytes (`null`: not needed), its mode. */
export type View = { readonly path: string; readonly text: string | null; readonly readonly: boolean };
