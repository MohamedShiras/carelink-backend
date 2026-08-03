-- CareLink Supabase schema
-- Run this in the Supabase SQL editor to create the tables used by the backend models.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'patient' check (role in ('patient', 'doctor', 'nurse', 'admin')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.users(id) on delete cascade,
  age integer,
  gender text,
  "bloodType" text,
  phone text,
  address text,
  "medicalHistory" text,
  "wellbeingStatus" text not null default 'Stable',
  "healthSummary" text not null default 'Your latest observations indicate a stable recovery pattern. The care team is monitoring blood pressure and kidney markers to keep treatment on track.',
  "medicationAdherence" integer not null default 96,
  "activeAlertsCount" integer not null default 0,
  "alertDetail" text not null default 'Follow-up required',
  diagnosis text not null default 'Chronic Hypertension & CKD Stage 3',
  allergies text not null default 'Penicillin, Sulfa drugs',
  warnings text not null default 'High Risk for Acute Kidney Injury',
  room text not null default 'Ward 3A - Bed 4',
  status text not null default 'Active',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.users(id) on delete cascade,
  specialization text not null default 'General Physician',
  "licenseNumber" text not null,
  phone text,
  availability text not null default 'Available',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid not null references public.patients(id) on delete cascade,
  "symptomsText" text not null,
  "severityScore" integer,
  "triagePriority" text not null default 'Low' check ("triagePriority" in ('Low', 'Medium', 'High', 'Emergency')),
  "aiRecommendation" text,
  "documentUrl" text,
  status text not null default 'Pending',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid references public.patients(id) on delete set null,
  "patientName" text not null,
  ward text not null,
  status text not null default 'Admitted',
  "admittedAt" timestamptz not null default now(),
  "nurseNotes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid not null references public.patients(id) on delete cascade,
  "doctorId" uuid not null references public.doctors(id) on delete cascade,
  "appointmentDate" date not null,
  "timeSlot" text not null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled', 'No-Show')),
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  "appointmentId" uuid not null references public.appointments(id) on delete cascade,
  "patientId" uuid not null references public.patients(id) on delete cascade,
  "doctorId" uuid not null references public.doctors(id) on delete cascade,
  medicines text not null,
  "dosageInstructions" text not null,
  status text not null default 'Issued',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.care_steps (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid not null references public.patients(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.health_updates (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid not null references public.patients(id) on delete cascade,
  title text not null,
  detail text not null,
  time text not null,
  "dotColor" text not null default '#10b981',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.nurse_logs (
  id uuid primary key default gen_random_uuid(),
  "patientId" uuid not null references public.patients(id) on delete cascade,
  "patientName" text not null,
  vitals text not null,
  notes text not null,
  "loggedBy" text not null default 'Nurse Jessica Smith',
  "loggedAt" text not null,
  escalated boolean not null default false,
  "escalationStatus" text not null default 'Normal',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_patients_user_id on public.patients ("userId");
create index if not exists idx_doctors_user_id on public.doctors ("userId");
create index if not exists idx_symptoms_patient_id on public.symptoms ("patientId");
create index if not exists idx_admissions_patient_id on public.admissions ("patientId");
create index if not exists idx_appointments_patient_id on public.appointments ("patientId");
create index if not exists idx_appointments_doctor_id on public.appointments ("doctorId");
create index if not exists idx_prescriptions_patient_id on public.prescriptions ("patientId");
create index if not exists idx_prescriptions_doctor_id on public.prescriptions ("doctorId");
create index if not exists idx_care_steps_patient_id on public.care_steps ("patientId");
create index if not exists idx_health_updates_patient_id on public.health_updates ("patientId");
create index if not exists idx_nurse_logs_patient_id on public.nurse_logs ("patientId");