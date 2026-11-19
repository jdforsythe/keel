const SHAPE = /^\$[a-z0-9-]{1,32}(\$[a-z0-9=,]{1,64})?\$[A-Za-z0-9+/]{22,}$/;

/** True for a stored token digest's shape: `$id[$params]$digest`, at most 128 characters. */
export function isDigested(value: string): boolean {
  return value.length <= 128 && SHAPE.test(value);
}
