import sequelize from '../config/database.js';
import User from './user.model.js';
import Patient from './patient.model.js';
import Doctor from './doctor.model.js';
import Symptom from './symptom.model.js';
import Appointment from './appointment.model.js';
import Prescription from './prescription.model.js';

// User & Patient relationships
User.hasOne(Patient, { foreignKey: 'userId', onDelete: 'CASCADE' });
Patient.belongsTo(User, { foreignKey: 'userId' });

// User & Doctor relationships
User.hasOne(Doctor, { foreignKey: 'userId', onDelete: 'CASCADE' });
Doctor.belongsTo(User, { foreignKey: 'userId' });

// Patient & Symptom relationships
Patient.hasMany(Symptom, { foreignKey: 'patientId', onDelete: 'CASCADE' });
Symptom.belongsTo(Patient, { foreignKey: 'patientId' });

// Patient & Appointment relationships
Patient.hasMany(Appointment, { foreignKey: 'patientId', onDelete: 'CASCADE' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId' });

// Doctor & Appointment relationships
Doctor.hasMany(Appointment, { foreignKey: 'doctorId', onDelete: 'CASCADE' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctorId' });

// Appointment & Prescription relationships
Appointment.hasOne(Prescription, { foreignKey: 'appointmentId', onDelete: 'CASCADE' });
Prescription.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Patient & Prescription relationships
Patient.hasMany(Prescription, { foreignKey: 'patientId', onDelete: 'CASCADE' });
Prescription.belongsTo(Patient, { foreignKey: 'patientId' });

// Doctor & Prescription relationships
Doctor.hasMany(Prescription, { foreignKey: 'doctorId', onDelete: 'CASCADE' });
Prescription.belongsTo(Doctor, { foreignKey: 'doctorId' });

export {
  sequelize,
  User,
  Patient,
  Doctor,
  Symptom,
  Appointment,
  Prescription
};
