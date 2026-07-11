alter table tasks
  add column if not exists priority text not null default 'medium',
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table tasks
  drop constraint if exists tasks_priority_check;

alter table tasks
  add constraint tasks_priority_check
    check (priority in ('low', 'medium', 'high'));

create index if not exists tasks_user_id_priority_updated_at_idx
  on tasks(user_id, priority, updated_at);
