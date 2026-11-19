/** Whether the render has an element `id` (`find` throws for one it has not). */
export function present(h: { find(id: string): unknown }, id: string): boolean {
  try {
    h.find(id);
    return true;
  } catch {
    return false;
  }
}
