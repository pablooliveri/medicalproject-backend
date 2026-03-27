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
  },
  branches: {
    type: [String],
    default: []
  },
  website: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: '$U'
  },
  statementIntroText: {
    type: String,
    default: 'Estimadas Familias, Adjuntamos Estado de Cuenta del Mes'
  },
  statementFooterText: {
    type: String,
    default: 'Recordamos que los pagos deben Realizarse del 1 al 5 de cada mes.\nQuedamos a las órdenes para cualquier consulta.'
  },
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
