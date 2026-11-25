/** What the amount field says for each way `parseMoney` can refuse the text, by the error's code. */
export default function amountText(code: string): string {
  switch (code) {
    case "money.tooManyDecimals":
      return "This currency has fewer decimal places. Round the amount to match.";
    case "money.currencyMismatch":
      return "The amount names another currency than the one picked.";
    case "money.overflow":
      return "That amount is too large.";
    default:
      return "Write the amount as digits, like 12.50.";
  }
}
