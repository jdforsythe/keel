create table api_tokens (
  id text primary key,
  digest text not null,
  user_id text not null
);
