import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

const dbConnectionString = process.env.DB_CONNECTION_STRING;

if (dbConnectionString && !dbConnectionString.includes('[YOUR_DB_PASSWORD]')) {
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
  console.log('Using local SQLite database (DB_CONNECTION_STRING placeholder not replaced or not set).');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite',
    logging: false,
  });
}

export default sequelize;
