/** A file `upload` picks (k.e2e-page): its name, its type, and its content as text or bytes. */
export type UploadFile =
  | { readonly name: string; readonly type: string; readonly text: string }
  | { readonly name: string; readonly type: string; readonly bytes: Uint8Array };
