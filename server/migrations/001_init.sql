create table if not exists notes (
  id uuid primary key,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists notes_updated_at_idx on notes(updated_at);

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  notes text not null default '',
  due_date timestamptz,
  completed boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists tasks_updated_at_idx on tasks(updated_at);
