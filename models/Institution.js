const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  contactName: { type: String, trim: true },
  contactEmail: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  address: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  subscriptionStatus: { type: String, enum: ['active', 'expired', 'blocked'], default: 'active' },
  subscriptionStartDate: { type: Date },
  subscriptionEndDate: { type: Date },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Institution', institutionSchema);
