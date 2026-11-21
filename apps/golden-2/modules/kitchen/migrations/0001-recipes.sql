create table recipes (
  id text primary key,
  title text not null,
  minutes integer not null check (minutes between 1 and 600),
  favorite boolean not null default false,
  price_amount bigint not null,
  price_currency text not null,
  added_on date not null
);
create unique index recipes_title_key on recipes (lower(title));
