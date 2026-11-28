import { sdk } from "./sdk.ts";
type Charge = { amount: number };
type Receipt = { id: string };
export async function charge(p: Charge): Promise<Receipt | undefined> {
  try {
    return await sdk.charges.create(p);
  } catch (e) {
    if (e instanceof Error && e.name === "CardError") return undefined;
    throw e;
  }
}
