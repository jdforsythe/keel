import { stores } from "@keel/store";

/** Every live store's state by id. */
export const liveState = (): Readonly<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const [id, st] of stores()) out[id] = st.snapshot().state;
  return out;
};
