import { tx } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";
import { add } from "./add.ts";
import { cart } from "./cart.ts";
import { setCard } from "./setCard.ts";
import { setNote } from "./setNote.ts";
import { setPin } from "./setPin.ts";

/** Check out: note the masked card on the receipt. The fix: an empty card checks out nothing (the page says so). */
function checkout(): void {
  const card = cart.get("card");
  if (cart.get("items").length > 0 && card !== "")
    void tx(setNote, { note: `paid ${"*".repeat(card.length - 1)}${card.slice(-1)}` });
}

/** Type the pin: the store keeps only whether one is typed. */
function typePin(value: string): void {
  void tx(setPin, { set: value !== "" });
}

/** The cart page. */
export function CartPage(): Node {
  return Box({
    as: "main",
    id: "cart.page",
    children: () => [
      Button({ id: "cart.add", children: "Add", onClick: () => void tx(add, { sku: "a" }) }),
      Input({ id: "cart.card", label: "Card", onInput: (v) => void tx(setCard, { number: v }) }),
      Input({ id: "cart.note", label: "Note", onInput: (v) => void tx(setNote, { note: v }) }),
      Input({ id: "cart.pin", label: "Pin", type: "password", onInput: typePin }),
      Button({ id: "cart.checkout", children: "Checkout", onClick: checkout }),
      Text({ id: "cart.cardMissing", children: "A card is needed to check out." }),
    ],
  });
}
