const SHAPE = /^\$[a-z0-9-]{1,32}(\$[a-z0-9=,.-]{1,64})?\$[A-Za-z0-9+/]+$/;

/**
 * True for a stored token digest's shape: `$id[$params]$digest`, at most 128 characters. What the id, the params and
 * the digest hold is read by `check`, which answers `credentials.malformed` `parameters` for any it cannot use.
 */
export function isDigested(value: string): boolean {
  return value.length <= 128 && SHAPE.test(value);
}
