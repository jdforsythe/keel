create table receipts (
  id text primary key,
  shop text not null,
  amount bigint not null check (amount >= 0),
  currency text not null,
  paid_by text not null,
  note text,
  seq integer generated always as identity
);
