type Charge = { amount: number };
type Receipt = { id: string };
export const sdk = { charges: { create: async (_p: Charge): Promise<Receipt> => ({ id: "r1" }) } };
