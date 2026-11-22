-- API tokens a member minted: the token's id, the digest `check` compares, and when it stops working.
create table api_tokens (
  id text primary key,
  digest text not null,
  user_id text not null references members (user_id) on delete cascade,
  expires_at bigint not null
);

create index api_tokens_user on api_tokens (user_id);
