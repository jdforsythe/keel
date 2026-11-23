-- Each change of an item raises its revision: a write names the revision its writer read.
alter table items add column rev integer not null default 0;

-- The key of each write a page sent through its outbox, so a write sent again commits once.
create table list_writes (
  key text primary key,
  at bigint not null
);
