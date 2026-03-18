const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  cedula: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  admissionDate: {
    type: Date,
    required: true
  },
  photo: {
    type: String,
    default: null
  },
  sucursal: {
    type: String,
    default: 'Casa 1'
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

residentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

residentSchema.set('toJSON', { virtuals: true });
residentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Resident', residentSchema);
