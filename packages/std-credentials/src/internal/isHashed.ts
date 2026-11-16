const SHAPE = /^\$[a-z0-9-]{1,32}(\$v=\d{1,4})?\$[a-z0-9=,]{1,64}\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

/** True for a stored credential's shape: `$id[$v=n]$params$salt$key`, at most 256 characters. */
export function isHashed(value: string): boolean {
  return value.length <= 256 && SHAPE.test(value);
}
