const mongoose = require('mongoose');

const deliveryItemSchema = new mongoose.Schema({
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  residentMedication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResidentMedication',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  }
});

const deliverySchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    required: true
  },
  deliveredBy: {
    type: String,
    required: true,
    trim: true
  },
  deliveryDate: {
    type: Date,
    default: Date.now
  },
  items: [deliveryItemSchema],
  photos: [{
    type: String
  }],
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);
