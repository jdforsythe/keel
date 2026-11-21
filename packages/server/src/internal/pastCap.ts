/**
 * The value sets known to be past a scrub cap (`SECRETS_CAP` values or `SCRUB_CAP` characters of forms): `holdSecrets`
 * adds a set here and takes no more values into it, and `automatonOf` is `"over"` for any list holding one, so every
 * text scrubbed with it is one mark from then on.
 */
export const pastCap = new WeakSet<ReadonlySet<string>>();
