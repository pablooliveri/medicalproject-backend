const mongoose = require('mongoose');

const residentMedicationSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  dosageMg: {
    type: Number,
    required: true
  },
  schedule: {
    breakfast: { type: Number, default: 0 },
    lunch: { type: Number, default: 0 },
    snack: { type: Number, default: 0 },
    dinner: { type: Number, default: 0 }
  },
  currentStock: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    default: null
  }
}, {
  timestamps: true
});

// Virtual: total daily consumption
residentMedicationSchema.virtual('dailyConsumption').get(function() {
  return (this.schedule.breakfast || 0) +
         (this.schedule.lunch || 0) +
         (this.schedule.snack || 0) +
         (this.schedule.dinner || 0);
});

// Virtual: days remaining
residentMedicationSchema.virtual('daysRemaining').get(function() {
  const daily = this.dailyConsumption;
  if (daily === 0) return Infinity;
  return Math.floor(this.currentStock / daily);
});

// Virtual: coverage end date
residentMedicationSchema.virtual('coverageDate').get(function() {
  const daily = this.dailyConsumption;
  if (daily === 0) return null;
  const days = Math.floor(this.currentStock / daily);
  const coverDate = new Date();
  coverDate.setDate(coverDate.getDate() + days);
  return coverDate;
});

residentMedicationSchema.set('toJSON', { virtuals: true });
residentMedicationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ResidentMedication', residentMedicationSchema);
