-- Each change of an item raises its revision: a write names the revision its writer read.
alter table items add column rev integer not null default 0;

-- The key of each write a member's page sent through its outbox, so a write sent again commits once. A key is the
-- member's own: another member's write with the same key is a different write.
create table list_writes (
  owner text not null,
  key text not null,
  at bigint not null,
  primary key (owner, key)
);
