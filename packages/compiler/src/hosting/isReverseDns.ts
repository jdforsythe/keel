const REVERSE_DNS = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;

/**
 * Whether `id` is a reverse-DNS app id (k.shell, E1573): two or more dot-separated labels, each starting with a
 * letter and holding letters, digits, `_` and `-` (`dev.example.app`).
 */
export function isReverseDns(id: string): boolean {
  return REVERSE_DNS.test(id);
}
