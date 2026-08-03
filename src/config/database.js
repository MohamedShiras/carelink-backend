import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

const dbConnectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.DB_CONNECTION_STRING;

const isLiveDbUrl = (value) => {
  if (!value) return false;
  return !value.includes('[YOUR_DB_PASSWORD]') && !value.toLowerCase().includes('placeholder');
};

if (isLiveDbUrl(dbConnectionString)) {
  console.log('Connecting to Supabase PostgreSQL database...');
  sequelize = new Sequelize(dbConnectionString, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Required for Supabase external SSL connections
      }
    },
    logging: false,
  });
} else {
  console.log('Using local SQLite database. Set SUPABASE_DB_URL or DATABASE_URL to enable the live Supabase database.');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite',
    logging: false,
  });
}

export default sequelize;
