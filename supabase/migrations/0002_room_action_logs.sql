create table if not exists public.room_action_logs (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_revision integer not null,
  round integer not null,
  phase text not null,
  actor_seat text not null,
  action_type text not null,
  payload_summary_zh text not null,
  result_summary_zh text not null,
  status_before_json jsonb not null,
  status_after_json jsonb not null,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_action_logs_room_revision on public.room_action_logs(room_id, room_revision desc);
