import { owner, scope } from "@keel/reactive";

/** Run `hook` when the scope running the caller is disposed; with no scope running there is nothing to end it. */
export function onOwnerDispose(hook: () => void): void {
  if (owner() === undefined) return;
  scope(() => {}).onDispose(hook);
}
