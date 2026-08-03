import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Nurse = sequelize.define('Nurse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING,
    defaultValue: 'General Ward',
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
  },
  nicFrontUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  nicBackUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  licenseDocumentUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cvDocumentUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'nurses',
  freezeTableName: true,
});

export default Nurse;
