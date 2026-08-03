import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bloodType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  medicalHistory: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  wellbeingStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Stable',
  },
  healthSummary: {
    type: DataTypes.TEXT,
    defaultValue: 'Your latest observations indicate a stable recovery pattern. The care team is monitoring blood pressure and kidney markers to keep treatment on track.',
  },
  medicationAdherence: {
    type: DataTypes.INTEGER,
    defaultValue: 96,
  },
  activeAlertsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  alertDetail: {
    type: DataTypes.STRING,
    defaultValue: 'Follow-up required',
  },
  diagnosis: {
    type: DataTypes.STRING,
    defaultValue: 'Chronic Hypertension & CKD Stage 3',
  },
  allergies: {
    type: DataTypes.STRING,
    defaultValue: 'Penicillin, Sulfa drugs',
  },
  warnings: {
    type: DataTypes.STRING,
    defaultValue: 'High Risk for Acute Kidney Injury',
  },
  room: {
    type: DataTypes.STRING,
    defaultValue: 'Ward 3A - Bed 4',
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active',
  },
}, {
  tableName: 'patients',
  freezeTableName: true,
});

export default Patient;
