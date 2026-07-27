import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NurseLog = sequelize.define('NurseLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  patientName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vitals: {
    type: DataTypes.STRING, // e.g. "BP: 158/92, HR: 78 bpm"
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  loggedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Nurse Jessica Smith',
  },
  loggedAt: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  escalated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  escalationStatus: {
    type: DataTypes.STRING, // e.g., "Normal", "Critical", "Acknowledged"
    defaultValue: 'Normal',
  },
});

export default NurseLog;
