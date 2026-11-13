-- Nur nötig, falls die Tabelle „fortschritt" in deiner verbundenen Supabase-DB
-- noch NICHT existiert. Nutzt der Zeittracker dieselbe Supabase-Datenbank wie
-- der Psychologie-Aufnahmetest, steht sie bereits und hier ist nichts zu tun.
--
-- Einmalig im Supabase-Dashboard unter SQL Editor ausführen. Legt die Tabelle
-- an, in der /api/data den gemeinsamen Datenstand ablegt (app = "zeittracker").

create table if not exists public.fortschritt (
  app          text        not null,
  code         text        not null,
  daten        jsonb       not null,
  aktualisiert timestamptz not null default now(),
  primary key (app, code)
);

-- Zugriff nur über den Service-Role-Key der Serverless-Funktion: Row Level
-- Security an, aber keine Policy — damit kommt der öffentliche anon-Key nicht
-- an die Tabelle heran, der Service-Role-Key umgeht RLS ohnehin.
alter table public.fortschritt enable row level security;
