import { ReceiptsText } from "../ReceiptsText.schema.ts";

export default ReceiptsText.text({
  heading: "Receipts",
  count: { plural: "n", "=0": "No receipts yet", one: "# receipt", other: "# receipts" },
  empty: "Record the first receipt with the form below.",
  paidBy: { select: "who", cases: { alex: "Paid by Alex", sam: "Paid by Sam" } },
  formHeading: "Record a receipt",
  shop: "Shop",
  amount: "Amount",
  currency: "Currency",
  payer: "Paid by",
  alex: "Alex",
  sam: "Sam",
  note: "Note",
  save: "Save receipt",
  saving: "Saving",
  amountFormat: "Write the amount with up to two decimals, such as 12.50",
  full: "The book holds 200 receipts. Remove one to add another.",
  switchTo: "Deutsch",
});
