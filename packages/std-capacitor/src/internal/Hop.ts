/** One native request of a `net.fetch` (k.shell Origins): where it goes, how, and whether it carries the request's body. */
export type Hop = {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: boolean;
};
