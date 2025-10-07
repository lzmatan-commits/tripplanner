create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  is_admin boolean default false,
  created_at timestamp with time zone default now()
);
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  tz text not null default 'Asia/Tokyo',
  created_at timestamp with time zone default now()
);
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  type text not null check (type in ('attraction','restaurant','market','museum','park')),
  name text not null,
  lat double precision,lng double precision,rating numeric,tags text[],
  open_hours_json jsonb,desc_he text,desc_en text,maps_url text,image_url text,
  duration_min int default 60,created_at timestamp with time zone default now()
);
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,start_date date,end_date date,pace text,interests text[],
  created_at timestamp with time zone default now()
);
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,city_id uuid references public.cities(id),transport text,hotel_name text,
  created_at timestamp with time zone default now()
);
create table if not exists public.day_entries (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days(id) on delete cascade,
  order_idx int not null default 0,kind text not null check (kind in ('place','hotel','transport','note')),
  ref_id uuid,duration_min int,note_he text,note_en text,created_at timestamp with time zone default now()
);
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.places enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.day_entries enable row level security;
create policy "profiles self" on public.profiles for select using (auth.uid() = id);
create policy "profiles admin all" on public.profiles for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "cities read all" on public.cities for select using (true);
create policy "places read all" on public.places for select using (true);
create policy "cities write admin" on public.cities for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "places write admin" on public.places for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "trips owner read" on public.trips for select using (auth.uid() = user_id);
create policy "trips owner write" on public.trips for all using (auth.uid() = user_id);
create policy "trip_days owner read" on public.trip_days for select using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));
create policy "trip_days owner write" on public.trip_days for all using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));
create policy "day_entries owner read" on public.day_entries for select using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and t.user_id = auth.uid()));
create policy "day_entries owner write" on public.day_entries for all using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and t.user_id = auth.uid()));
create or replace function public.handle_new_user() returns trigger as $$ begin insert into public.profiles (id,is_admin) values (new.id,false); return new; end; $$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
