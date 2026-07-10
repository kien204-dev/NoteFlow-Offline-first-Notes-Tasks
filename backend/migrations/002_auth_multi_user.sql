create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes
  add column if not exists user_id uuid references users(id) on delete cascade;

create index if not exists notes_user_id_updated_at_idx on notes(user_id, updated_at);

alter table tasks
  add column if not exists user_id uuid references users(id) on delete cascade;

create index if not exists tasks_user_id_updated_at_idx on tasks(user_id, updated_at);
