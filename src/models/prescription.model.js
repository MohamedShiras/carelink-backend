import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  medicines: {
    type: DataTypes.TEXT, // Text description or JSON of medicines, dosages
    allowNull: false,
  },
  dosageInstructions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // e.g., 'Issued', 'Dispensed'
    defaultValue: 'Issued',
  },
});

export default Prescription;
