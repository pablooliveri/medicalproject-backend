const Delivery = require('../models/Delivery');
const ResidentMedication = require('../models/ResidentMedication');
const StockMovement = require('../models/StockMovement');
const { checkLowStock } = require('../utils/notificationChecker');

// GET /api/deliveries
const getDeliveries = async (req, res) => {
  try {
    const { residentId } = req.query;
    const query = {};
    if (residentId) query.resident = residentId;

    const deliveries = await Delivery.find(query)
      .populate('resident')
      .populate('items.medication')
      .sort({ deliveryDate: -1 });

    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/deliveries/:id
const getDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('resident')
      .populate('items.medication')
      .populate('items.residentMedication');

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/deliveries
const createDelivery = async (req, res) => {
  try {
    const { resident, deliveredBy, deliveryDate, notes } = req.body;
    let items = req.body.items;

    // Parse items if sent as JSON string (from FormData)
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Handle photo uploads
    const photos = req.files ? req.files.map(f => `/uploads/deliveries/${f.filename}`) : [];

    // Create delivery
    const delivery = await Delivery.create({
      resident,
      deliveredBy,
      deliveryDate: deliveryDate || new Date(),
      items,
      photos,
      notes
    });

    // Update stock for each item
    for (const item of items) {
      const resMed = await ResidentMedication.findById(item.residentMedication);
      if (resMed) {
        const previousStock = resMed.currentStock;
        const newStock = previousStock + Number(item.quantity);

        await StockMovement.create({
          resident,
          residentMedication: resMed._id,
          medication: item.medication,
          type: 'delivery',
          quantity: Number(item.quantity),
          previousStock,
          newStock,
          notes: `Delivery by ${deliveredBy}`
        });

        resMed.currentStock = newStock;
        await resMed.save();
      }
    }

    await checkLowStock();

    const populated = await Delivery.findById(delivery._id)
      .populate('resident')
      .populate('items.medication');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/deliveries/history
const getDeliveryHistory = async (req, res) => {
  try {
    const { residentId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (residentId) query.resident = residentId;

    const total = await Delivery.countDocuments(query);
    const deliveries = await Delivery.find(query)
      .populate('resident')
      .populate('items.medication')
      .sort({ deliveryDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      deliveries,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDeliveries, getDelivery, createDelivery, getDeliveryHistory };
