/** Await an input; a throw is the app's (a Boundary catch the recorder already saw), so the replay goes on. */
export async function quiet(p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch {
    // Observed through `record`.
  }
}
