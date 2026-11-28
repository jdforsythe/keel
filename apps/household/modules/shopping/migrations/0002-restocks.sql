-- One row per staple a weekly run has handled, keyed by the workflow step's key: a step that runs again after a crash
-- finds its row and answers what it did the first time.
create table restocks (
  key text primary key,
  name text not null check (length(name) between 1 and 60),
  put_back boolean not null
);
