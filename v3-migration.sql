alter table posts add column if not exists slug varchar(220);
alter table posts add column if not exists status varchar(20) not null default 'published';
alter table posts add column if not exists cover_image_url text;
alter table posts add column if not exists updated_at timestamptz not null default now();
update posts set slug = lower(trim(both '-' from regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))) || '-' || id where slug is null;
alter table posts alter column slug set not null;
create unique index if not exists posts_slug_idx on posts(slug);
create index if not exists posts_status_created_idx on posts(status, created_at desc);
