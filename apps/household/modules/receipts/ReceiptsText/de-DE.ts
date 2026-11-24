import { ReceiptsText } from "../ReceiptsText.schema.ts";

export default ReceiptsText.text({
  heading: "Belege",
  count: { plural: "n", "=0": "Noch keine Belege", one: "# Beleg", other: "# Belege" },
  empty: "Erfasse den ersten Beleg mit dem Formular unten.",
  paidBy: { select: "who", cases: { alex: "Bezahlt von Alex", sam: "Bezahlt von Sam" } },
  formHeading: "Beleg erfassen",
  shop: "Geschäft",
  amount: "Betrag",
  currency: "Währung",
  payer: "Bezahlt von",
  alex: "Alex",
  sam: "Sam",
  note: "Notiz",
  save: "Beleg speichern",
  saving: "Wird gespeichert",
  amountFormat: "Schreibe den Betrag mit bis zu zwei Nachkommastellen, etwa 12,50",
  full: "Das Buch fasst 200 Belege. Entferne einen, um einen neuen hinzuzufügen.",
  switchTo: "English",
});
