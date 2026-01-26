alter table public.schedules
add column if not exists payback_expected_date text;

alter table public.schedules
add column if not exists payback_expected_amount numeric;

-- Backfill defaults for existing data
update public.schedules
set payback_expected_date = deadline
where payback_expected is true
  and payback_expected_date is null
  and deadline is not null;
