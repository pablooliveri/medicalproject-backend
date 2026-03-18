const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  genericName: {
    type: String,
    required: true,
    trim: true
  },
  commercialName: {
    type: String,
    default: '',
    trim: true
  },
  dosageUnit: {
    type: String,
    required: true,
    enum: ['mg', 'ml', 'g', 'mcg', 'UI', 'drops', 'sachets', 'tablets', 'capsules', 'other'],
    default: 'mg'
  },
  form: {
    type: String,
    enum: ['tablet', 'capsule', 'liquid', 'drops', 'injection', 'cream', 'inhaler', 'sachet', 'other'],
    default: 'tablet'
  },
  description: {
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

module.exports = mongoose.model('Medication', medicationSchema);
