const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: 'Casa de Salud Residencial'
  },
  logo: {
    type: String,
    default: null
  },
  lowStockThresholdDays: {
    type: Number,
    default: 5
  },
  language: {
    type: String,
    enum: ['en', 'es'],
    default: 'en'
  },
  address: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
