import type { FieldIssue } from "@keel/forms";
import type { RecipesText } from "./RecipesText.schema.ts";

/** The new-recipe form's `issueText`: each field's rule from the entry, whatever the rule that failed. */
export function fieldText(text: RecipesText): (issue: FieldIssue) => string {
  return (issue) => {
    switch (issue.path) {
      case "title":
        return text.titleRule;
      case "minutes":
        return text.minutesRule;
      case "price.amount":
        return text.amountRule;
      case "price.currency":
        return text.currencyRule;
      default:
        return text.otherRule;
    }
  };
}
