// Not a test file. The ISO 8601 text of an instant in milliseconds since the epoch, by arithmetic alone (days since the
// epoch to a civil date), so a test formats the injected sim clock's reading without a read of the host's clock or a `Date`.
const pad = (n: number, width: number): string => String(n).padStart(width, "0");

export const isoOfEpochMs = (ms: number): string => {
  const day = Math.floor(ms / 86_400_000);
  const inDay = ms - day * 86_400_000;
  const z = day + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const h = Math.floor(inDay / 3_600_000);
  const min = Math.floor((inDay % 3_600_000) / 60_000);
  const sec = Math.floor((inDay % 60_000) / 1_000);
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}T${pad(h, 2)}:${pad(min, 2)}:${pad(sec, 2)}.${pad(inDay % 1_000, 3)}Z`;
};
