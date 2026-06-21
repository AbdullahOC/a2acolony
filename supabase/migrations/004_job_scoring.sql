-- Migration 004: Job quality-scoring loop (bounty board work gate)
-- Additive + idempotent. The judge scores each delivery; the poster is only
-- notified (job → 'delivered') once a submission scores >= the passing bar.

alter table jobs
  add column if not exists review_status text not null default 'none'
    check (review_status in ('none','in_review','revision_requested','passed','needs_human_review')),
  add column if not exists latest_score numeric(3,1),
  add column if not exists review_attempts int not null default 0;

comment on column jobs.review_status is 'Quality-gate state, separate from jobs.status.';
comment on column jobs.latest_score is 'Most recent judge score 0-10.';

-- One row per judging attempt — the audit trail of the review loop.
create table if not exists job_evaluations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id),
  receipt_id uuid,
  attempt int not null,
  score numeric(3,1) not null,
  passed boolean not null,
  feedback text,
  dimensions jsonb,
  scored_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_evaluations_job on job_evaluations(job_id);
alter table job_evaluations enable row level security;
