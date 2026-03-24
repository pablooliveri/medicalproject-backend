const mongoose = require('mongoose');

const monthlyStatementSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  monthlyFee: {
    type: Number,
    default: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  adjustmentApplied: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  },
  addenda: {
    type: String,
    default: ''
  },
  locked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

monthlyStatementSchema.index({ resident: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyStatement', monthlyStatementSchema);
