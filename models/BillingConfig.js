const mongoose = require('mongoose');

const billingConfigSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true,
    unique: true
  },
  monthlyFee: {
    type: Number,
    default: 0
  },
  adjustmentPercentage: {
    type: Number,
    default: 0
  },
  adjustmentMonths: {
    type: [Number],
    default: []
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BillingConfig', billingConfigSchema);
