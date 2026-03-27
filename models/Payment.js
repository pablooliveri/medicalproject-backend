const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  statement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonthlyStatement',
    required: true
  },
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    enum: ['cash', 'transfer', 'other'],
    default: 'cash'
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

paymentSchema.index({ statement: 1 });
paymentSchema.index({ resident: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
