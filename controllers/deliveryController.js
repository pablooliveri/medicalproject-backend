const Delivery = require('../models/Delivery');
const ResidentMedication = require('../models/ResidentMedication');
const StockMovement = require('../models/StockMovement');
const { checkLowStock } = require('../utils/notificationChecker');
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require('../utils/cloudinary');

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

    // Handle photo uploads to Cloudinary
    const photos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'medical/deliveries');
        photos.push(result.secure_url);
      }
    }

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

// PUT /api/deliveries/:id
const updateDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    const { deliveredBy, deliveryDate, notes } = req.body;
    let newItems = req.body.items;
    if (typeof newItems === 'string') {
      newItems = JSON.parse(newItems);
    }

    // Reverse stock for old items
    for (const oldItem of delivery.items) {
      const resMed = await ResidentMedication.findById(oldItem.residentMedication);
      if (resMed) {
        const previousStock = resMed.currentStock;
        const newStock = previousStock - Number(oldItem.quantity);
        resMed.currentStock = newStock;
        await resMed.save();

        await StockMovement.create({
          resident: delivery.resident,
          residentMedication: resMed._id,
          medication: oldItem.medication,
          type: 'adjustment',
          quantity: -Number(oldItem.quantity),
          previousStock,
          newStock,
          notes: `Delivery edit reversal`
        });
      }
    }

    // Apply stock for new items
    for (const item of newItems) {
      const resMed = await ResidentMedication.findById(item.residentMedication);
      if (resMed) {
        const previousStock = resMed.currentStock;
        const newStock = previousStock + Number(item.quantity);
        resMed.currentStock = newStock;
        await resMed.save();

        await StockMovement.create({
          resident: delivery.resident,
          residentMedication: resMed._id,
          medication: item.medication,
          type: 'delivery',
          quantity: Number(item.quantity),
          previousStock,
          newStock,
          notes: `Delivery updated by ${deliveredBy}`
        });
      }
    }

    // Handle photos: use existingPhotos from frontend (user may have removed some)
    let existingPhotos = req.body.existingPhotos;
    if (typeof existingPhotos === 'string') {
      try { existingPhotos = JSON.parse(existingPhotos); } catch { existingPhotos = delivery.photos; }
    } else {
      existingPhotos = delivery.photos;
    }

    // Delete removed photos from Cloudinary
    for (const oldPhoto of delivery.photos) {
      if (!existingPhotos.includes(oldPhoto)) {
        await deleteFromCloudinary(getPublicIdFromUrl(oldPhoto));
      }
    }

    // Upload newly added photos to Cloudinary
    const uploadedPhotos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'medical/deliveries');
        uploadedPhotos.push(result.secure_url);
      }
    }
    const photos = [...existingPhotos, ...uploadedPhotos];

    delivery.deliveredBy = deliveredBy || delivery.deliveredBy;
    delivery.deliveryDate = deliveryDate || delivery.deliveryDate;
    delivery.notes = notes !== undefined ? notes : delivery.notes;
    delivery.items = newItems || delivery.items;
    delivery.photos = photos;
    await delivery.save();

    await checkLowStock();

    const populated = await Delivery.findById(delivery._id)
      .populate('resident')
      .populate('items.medication')
      .populate('items.residentMedication');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/deliveries/:id
const deleteDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Reverse stock for all items
    for (const item of delivery.items) {
      const resMed = await ResidentMedication.findById(item.residentMedication);
      if (resMed) {
        const previousStock = resMed.currentStock;
        const newStock = previousStock - Number(item.quantity);
        resMed.currentStock = Math.max(0, newStock);
        await resMed.save();

        await StockMovement.create({
          resident: delivery.resident,
          residentMedication: resMed._id,
          medication: item.medication,
          type: 'adjustment',
          quantity: -Number(item.quantity),
          previousStock,
          newStock: Math.max(0, newStock),
          notes: `Delivery deleted`
        });
      }
    }

    // Delete photos from Cloudinary
    for (const photo of delivery.photos) {
      await deleteFromCloudinary(getPublicIdFromUrl(photo));
    }

    await Delivery.findByIdAndDelete(req.params.id);
    await checkLowStock();

    res.json({ message: 'Delivery deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDeliveries, getDelivery, createDelivery, getDeliveryHistory, updateDelivery, deleteDelivery };
