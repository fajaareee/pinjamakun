import { readApiEnvironment } from '@pinjamakun/config';
import postgres from 'postgres';

const environment = readApiEnvironment(process.env);
const sql = postgres(environment.databaseUrl, { max: 1 });

try {
  await sql.begin(async (transaction) => {
    await transaction`
      create table if not exists users (
        id uuid primary key,
        email text not null unique,
        password_hash text not null,
        created_at timestamptz not null default now(),
        constraint users_email_normalized check (email = lower(email))
      )
    `;
    await transaction`
      create table if not exists auth_sessions (
        token_hash text primary key,
        user_id uuid not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    `;
    await transaction`
      create index if not exists auth_sessions_user_id_idx on auth_sessions(user_id)
    `;
    await transaction`
      create index if not exists auth_sessions_expires_at_idx on auth_sessions(expires_at)
    `;
  });
  console.info('Database migration completed');
} finally {
  await sql.end({ timeout: 5 });
}
