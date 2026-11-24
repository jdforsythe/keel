/**
 * What `KEEL_DEV_POLL` asks of `keel dev` (k.topology Dev watcher): `1` is `"on"`; unset, empty or `0` is `"off"`; any
 * other value is `undefined`, which `keel dev` reports as one E1560 naming the key and not the value.
 */
export function devPoll(value: string | undefined): "on" | "off" | undefined {
  if (value === "1") return "on";
  if (value === undefined || value === "" || value === "0") return "off";
  return undefined;
}
