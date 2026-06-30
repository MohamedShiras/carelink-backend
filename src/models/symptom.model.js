import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Symptom = sequelize.define('Symptom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  symptomsText: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  severityScore: {
    type: DataTypes.INTEGER, // e.g., 1-10 or scaled
    allowNull: true,
  },
  triagePriority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Emergency'),
    allowNull: false,
    defaultValue: 'Low',
  },
  aiRecommendation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // e.g., 'Pending', 'Reviewed'
    defaultValue: 'Pending',
  },
});

export default Symptom;
