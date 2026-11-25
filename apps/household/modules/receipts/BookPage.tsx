import { BarChart } from "@keel-libs/charts";
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
import { spendOf } from "./spendOf.ts";

export const Props = s.object({ params: BookParams, data: BookData });

export default function BookPage(props: Infer<typeof Props>) {
  const f = form(NewReceipt, {
    id: "receipts.new",
    initial: { amount: "", currency: "EUR", paidBy: "alex" },
  });
  return (
    <Box as="section" id="receipts.page" direction="column" gap="4">
      <Heading id="receipts.heading" level={1} fontSize={{ base: "xl", md: "2xl" }}>
        {props.data.text.heading}
      </Heading>
      <Box direction="row" justify="between" align="baseline" gap="3" wrap="wrap">
        <Text id="receipts.count" role="status" font="mono" fontSize="sm" fg="textSecondary">
          {formatMessage(props.data.text.count, { n: props.data.receipts.length }, props.params.locale)}
        </Text>
        <Link
          id="receipts.switch"
          font="mono"
          fontSize="sm"
          lang={props.params.locale === "en-US" ? "de-DE" : "en-US"}
          to={receipts.href("receipts.book", { locale: props.params.locale === "en-US" ? "de-DE" : "en-US" })}
        >
          {props.data.text.switchTo}
        </Link>
      </Box>
      <If when={props.data.receipts.length === 0}>
        <Text id="receipts.empty" fg="textSecondary" p="4" bg="card" border="hairline">
          {props.data.text.empty}
        </Text>
      </If>
      <Box as="ul" id="receipts.list" direction="column" gap="hairline" bg="divider" p="0" m="0">
        <For each={props.data.receipts} key="id">
          {(r) => (
            <Box
              as="li"
              id={`receipts.row.${r.id}`}
              direction="row"
              justify="between"
              align="baseline"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Box direction="column" gap="1">
                <Text id={`receipts.shop.${r.id}`} fontSize="lg">
                  {r.shop}
                </Text>
                <Text id={`receipts.payer.${r.id}`} fontSize="sm" fg="textSecondary">
                  {formatMessage(props.data.text.paidBy, { who: r.paidBy }, props.params.locale)}
                </Text>
              </Box>
              <Text id={`receipts.total.${r.id}`} font="mono" fontSize="lg">
                {formatMoney(r.total, props.params.locale)}
              </Text>
            </Box>
          )}
        </For>
      </Box>
      <For each={spendOf(props.data.receipts)} key="currency">
        {(c) => (
          <BarChart
            id={`receipts.spend.${c.currency}`}
            label={formatMessage(props.data.text.spendLabel, { currency: c.currency }, props.params.locale)}
            summary={formatMessage(
              props.data.text.spendSummary,
              { alex: formatMoney(c.alex, props.params.locale), sam: formatMoney(c.sam, props.params.locale) },
              props.params.locale,
            )}
            points={[
              { name: props.data.text.alex, value: c.alex.amount, shown: formatMoney(c.alex, props.params.locale) },
              { name: props.data.text.sam, value: c.sam.amount, shown: formatMoney(c.sam, props.params.locale) },
            ]}
            text={{ numbers: props.data.text.numbers, name: props.data.text.payer, value: props.data.text.paid }}
            styles={{ chart: { fg: "accent" }, summary: { fontSize: "sm", fg: "textSecondary" } }}
          />
        )}
      </For>
      <Box h="hairline" bg="divider" />
      <Heading id="receipts.formHeading" level={2} fontSize="lg">
        {props.data.text.formHeading}
      </Heading>
      <Form method="POST" action={receipts.href("receipts.book", { locale: props.params.locale })} form={f}>
        <Box look="panel">
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
          <Box direction="row">
            <Button id="receipts.save" type="submit">
              {props.data.text.save}
            </Button>
          </Box>
          <Text id="receipts.saving" role="status" font="mono" fontSize="sm" fg="textSecondary">
            {f.pending() ? props.data.text.saving : ""}
          </Text>
        </Box>
      </Form>
    </Box>
  );
}
