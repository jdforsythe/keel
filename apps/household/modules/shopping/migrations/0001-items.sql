create table items (
  id text primary key,
  name text not null check (length(name) between 1 and 60),
  qty integer not null check (qty between 1 and 99),
  bought boolean not null,
  seq integer generated always as identity
);

-- One open item per name: adding a name already on the list raises its quantity.
create unique index items_open_name on items (name) where not bought;
