/**
 * A document navigation a page started (k.mount Testing): a followed link, `navigate` or `ok(href)` to a path the
 * router has no page for (a GET, `body` null), or a native form post (`body` its urlencoded text).
 */
export type DocumentNavigation = {
  readonly method: string;
  readonly url: string;
  readonly body: string | null;
};
