create table if not exists users (
  id bigserial primary key,
  username varchar(50) unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id bigserial primary key,
  title varchar(200) not null,
  body text not null,
  author_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on posts(created_at desc);

alter table posts add column if not exists excerpt varchar(320);
alter table posts add column if not exists categories varchar(200);
