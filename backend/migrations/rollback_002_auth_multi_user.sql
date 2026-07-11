-- Manual rollback helper for 002_auth_multi_user.sql.
-- The current migration runner only applies forward migrations, so do not run
-- this file through npm run server:migrate. Use it manually only after taking a
-- production backup and confirming that auth data can be discarded.

drop index if exists tasks_user_id_updated_at_idx;
drop index if exists notes_user_id_updated_at_idx;

alter table tasks
  drop column if exists user_id;

alter table notes
  drop column if exists user_id;

drop table if exists users;
