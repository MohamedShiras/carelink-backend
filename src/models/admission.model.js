import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Admission = sequelize.define('Admission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    patientId: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    patientName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ward: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Admission Ordered',
    },
    admittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    nurseNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    doctorId: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    doctorName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    assignedNurseId: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    assignedNurseName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    admissionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'admissions',
    freezeTableName: true,
});

export default Admission;