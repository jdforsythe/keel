-- One row per member who has signed in: the sign-in library's user id, and the personal details the profile shows.
create table members (
  user_id text primary key,
  email text not null,
  name text not null,
  phone text
);
