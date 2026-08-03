import sequelize from '../src/config/database.js';

async function migrate() {
  console.log('Migrating Supabase PostgreSQL for Nurse Ecosystem...');

  // Create public.nurses table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS public.nurses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      department text DEFAULT 'General Ward',
      "licenseNumber" text UNIQUE,
      phone text,
      status text DEFAULT 'Pending',
      "nicFrontUrl" text,
      "nicBackUrl" text,
      "licenseDocumentUrl" text,
      "cvDocumentUrl" text,
      "rejectionReason" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Extend public.admissions table
  await sequelize.query('ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "doctorId" uuid;');
  await sequelize.query('ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "doctorName" text;');
  await sequelize.query('ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "assignedNurseId" uuid;');
  await sequelize.query('ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "assignedNurseName" text;');
  await sequelize.query('ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "admissionReason" text;');

  // Set existing nurses to Approved if any
  await sequelize.query('UPDATE public.nurses SET status = \'Approved\' WHERE status IS NULL OR status = \'Pending\';');

  console.log('Nurse ecosystem DB migration executed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
