type Net = { get(): Promise<string> };
export async function load(net: Net): Promise<string | undefined> {
  try {
    return await net.get();
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") return undefined;
    throw e;
  }
}
