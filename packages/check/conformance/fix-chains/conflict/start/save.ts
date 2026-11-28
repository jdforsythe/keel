export async function save(tx: () => Promise<number>, tries: number): Promise<number | undefined> {
  for (let i = 0; i < tries; i++) {
    try {
      return await tx();
    } catch (e) {
      if (!(e instanceof Error && e.name === "ConflictError")) return undefined;
    }
  }
  return undefined;
}
