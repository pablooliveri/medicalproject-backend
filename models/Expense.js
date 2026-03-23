const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  concept: {
    type: String,
    required: true,
    trim: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 0
  },
  amount: {
    type: Number,
    default: 0
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
  photo: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

expenseSchema.index({ resident: 1, year: 1, month: 1 });

// Auto-calculate amount before save
expenseSchema.pre('save', function () {
  this.amount = this.unitPrice * this.quantity;
});

module.exports = mongoose.model('Expense', expenseSchema);
