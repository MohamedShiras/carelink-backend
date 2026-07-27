import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const HealthUpdate = sequelize.define('HealthUpdate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING, // e.g., "Today, 07:20 AM"
    allowNull: false,
  },
  dotColor: {
    type: DataTypes.STRING, // e.g., "#10b981", "#3b82f6"
    defaultValue: '#10b981',
  },
});

export default HealthUpdate;
