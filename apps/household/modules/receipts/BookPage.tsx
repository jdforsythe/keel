import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { formatMoney } from "@keel/std-money";
import { Box, Button, Heading, Input, Link, Select, Text, TextArea } from "@keel/ui";
import { BookData } from "./BookData.schema.ts";
import { BookParams } from "./BookParams.schema.ts";
import { NewReceipt } from "./NewReceipt.schema.ts";
import { receipts } from "./receipts.contract.ts";

export const Props = s.object({ params: BookParams, data: BookData });

export default function BookPage(props: Infer<typeof Props>) {
  const f = form(NewReceipt, {
    id: "receipts.new",
    initial: { amount: "", currency: "EUR", paidBy: "alex" },
  });
  return (
    <Box as="main" id="receipts.page" p="4" gap="3">
      <Heading id="receipts.heading" level={1}>
        {props.data.text.heading}
      </Heading>
      <Link
        id="receipts.switch"
        lang={props.params.locale === "en-US" ? "de-DE" : "en-US"}
        to={receipts.href("receipts.book", { locale: props.params.locale === "en-US" ? "de-DE" : "en-US" })}
      >
        {props.data.text.switchTo}
      </Link>
      <Text id="receipts.count">
        {formatMessage(props.data.text.count, { n: props.data.receipts.length }, props.params.locale)}
      </Text>
      <If when={props.data.receipts.length === 0}>
        <Text id="receipts.empty">{props.data.text.empty}</Text>
      </If>
      <Box as="ul" id="receipts.list" gap="2">
        <For each={props.data.receipts} key="id">
          {(r) => (
            <Box as="li" id={`receipts.row.${r.id}`} gap="1">
              <Text id={`receipts.shop.${r.id}`}>{r.shop}</Text>
              <Text id={`receipts.total.${r.id}`}>{formatMoney(r.total, props.params.locale)}</Text>
              <Text id={`receipts.payer.${r.id}`}>
                {formatMessage(props.data.text.paidBy, { who: r.paidBy }, props.params.locale)}
              </Text>
            </Box>
          )}
        </For>
      </Box>
      <Heading id="receipts.formHeading" level={2}>
        {props.data.text.formHeading}
      </Heading>
      <Form method="POST" action={receipts.href("receipts.book", { locale: props.params.locale })} form={f}>
        <Box gap="2">
          <Input field={f.field("shop")} label={props.data.text.shop} autocomplete="off" />
          <Input field={f.field("amount")} label={props.data.text.amount} autocomplete="off" />
          <Select
            field={f.field("currency")}
            label={props.data.text.currency}
            options={[
              { value: "EUR", label: "EUR" },
              { value: "USD", label: "USD" },
              { value: "GBP", label: "GBP" },
              { value: "JPY", label: "JPY" },
            ]}
          />
          <Select
            field={f.field("paidBy")}
            label={props.data.text.payer}
            options={[
              { value: "alex", label: props.data.text.alex },
              { value: "sam", label: props.data.text.sam },
            ]}
          />
          <TextArea field={f.field("note")} label={props.data.text.note} />
          <Button id="receipts.save" type="submit">
            {props.data.text.save}
          </Button>
          <If when={f.pending()}>
            <Text id="receipts.saving">{props.data.text.saving}</Text>
          </If>
        </Box>
      </Form>
    </Box>
  );
}
