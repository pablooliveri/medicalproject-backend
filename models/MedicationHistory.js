const mongoose = require('mongoose');

const medicationHistorySchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  residentMedication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResidentMedication',
    required: true
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  action: {
    type: String,
    enum: ['assigned', 'updated', 'deactivated', 'reactivated'],
    required: true
  },
  details: {
    dosageMg: { type: Number },
    schedule: {
      breakfast: { type: Number, default: 0 },
      lunch: { type: Number, default: 0 },
      snack: { type: Number, default: 0 },
      dinner: { type: Number, default: 0 }
    },
    notes: { type: String, default: '' }
  },
  date: {
    type: Date,
    default: Date.now
  },
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries by resident and date
medicationHistorySchema.index({ resident: 1, date: -1 });

module.exports = mongoose.model('MedicationHistory', medicationHistorySchema);
