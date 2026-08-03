import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CareStep = sequelize.define('CareStep', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'care_steps',
  freezeTableName: true,
});

export default CareStep;
