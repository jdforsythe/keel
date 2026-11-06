export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
