import sequelize from '../src/config/database.js';

async function migrate() {
  console.log('Migrating public.doctors table in Supabase PostgreSQL...');

  await sequelize.query('ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS "status" text DEFAULT \'Pending\';');
  await sequelize.query('ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS "nicFrontUrl" text;');
  await sequelize.query('ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS "nicBackUrl" text;');
  await sequelize.query('ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS "licenseDocumentUrl" text;');
  await sequelize.query('ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS "rejectionReason" text;');

  // Set existing doctors to Approved so seeded doctors remain accessible
  await sequelize.query('UPDATE public.doctors SET "status" = \'Approved\' WHERE "status" IS NULL OR "status" = \'Pending\';');

  console.log('Doctor approval migration executed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
