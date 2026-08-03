import sequelize from '../src/config/database.js';

async function migrate() {
  await sequelize.query('ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS "reportUrl" text;');
  await sequelize.query('ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS "reportName" text;');
  console.log('ALTER TABLE appointments succeeded!');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
