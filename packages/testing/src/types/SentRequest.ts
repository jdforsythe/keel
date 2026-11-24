/**
 * One request a harness's page sent (k.requests): the `method` and absolute `url` of the `fetch`, and the `headers`
 * names it entered `ctx.net` with, lower case and sorted. No header value and no body is kept.
 */
export interface SentRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: readonly string[];
}
