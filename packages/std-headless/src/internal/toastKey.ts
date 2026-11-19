const MAX = 64;

/** A short FNV-1a hash of `s` in base 36 (at most 7 characters). */
const hash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
};

/**
 * The chart instance key of a Toaster's live toast in `slot`: `<id>.<slot>`, or, when that passes 64 characters, the
 * id cut to 48 with a hash of the whole id. Never an item's id.
 */
export function toastKey(id: string, slot: number): string {
  const tail = `.${slot}`;
  return id.length + tail.length <= MAX ? id + tail : `${id.slice(0, 48)}.${hash(id)}${tail}`;
}
