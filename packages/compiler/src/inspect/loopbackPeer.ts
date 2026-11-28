/**
 * Whether a connection's remote address is this machine's loopback: `::1`, an address of `127.0.0.0/8`, or one of
 * those as an IPv4-mapped IPv6 address (`::ffff:127.0.0.1`, as a dual-stack socket reports an IPv4 peer). `undefined`
 * (no connection) is not.
 */
export function loopbackPeer(address: string | undefined): boolean {
  return address !== undefined && (address === "::1" || /^(::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(address));
}
