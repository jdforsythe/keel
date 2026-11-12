/** A request a user's sim net sent to the server's origin, before its cookies are added. */
export interface Outgoing {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: Uint8Array<ArrayBuffer> | null;
}
