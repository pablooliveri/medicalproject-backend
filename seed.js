const mongoose = require('mongoose');
require('dotenv').config();

const Resident = require('./models/Resident');
const Medication = require('./models/Medication');
const ResidentMedication = require('./models/ResidentMedication');
const Delivery = require('./models/Delivery');
const StockMovement = require('./models/StockMovement');
const Notification = require('./models/Notification');
const Settings = require('./models/Settings');
const MedicationHistory = require('./models/MedicationHistory');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data (except Users)
  await Resident.deleteMany({});
  await Medication.deleteMany({});
  await ResidentMedication.deleteMany({});
  await Delivery.deleteMany({});
  await StockMovement.deleteMany({});
  await Notification.deleteMany({});
  await Settings.deleteMany({});
  await MedicationHistory.deleteMany({});

  console.log('Cleared existing data (users preserved)');

  // 1. Create Settings
  const settings = await Settings.create({
    companyName: 'Casa de Salud Residencial',
    address: 'Av. San Martín 1250, Buenos Aires',
    phone: '+54 11 4555-1234',
    email: 'info@casadesalud.com',
    lowStockThresholdDays: 5,
    language: 'en'
  });
  console.log('Settings created');

  // 2. Create 10 Residents (distributed across 3 sucursales)
  const residents = await Resident.insertMany([
    { firstName: 'María', lastName: 'González', cedula: '12345678', admissionDate: new Date('2024-03-15'), notes: 'Diabetes type 2, hypertension', isActive: true, sucursal: 'Casa 1' },
    { firstName: 'Jorge', lastName: 'Martínez', cedula: '23456789', admissionDate: new Date('2024-01-10'), notes: 'Alzheimer stage 2', isActive: true, sucursal: 'Casa 1' },
    { firstName: 'Rosa', lastName: 'López', cedula: '34567890', admissionDate: new Date('2023-11-20'), notes: 'Cardiac patient, pacemaker', isActive: true, sucursal: 'Casa 1' },
    { firstName: 'Carlos', lastName: 'Fernández', cedula: '45678901', admissionDate: new Date('2024-06-01'), notes: 'Parkinson disease', isActive: true, sucursal: 'Casa 2' },
    { firstName: 'Ana', lastName: 'Rodríguez', cedula: '56789012', admissionDate: new Date('2023-08-15'), notes: 'Depression, anxiety', isActive: true, sucursal: 'Casa 2' },
    { firstName: 'Roberto', lastName: 'Díaz', cedula: '67890123', admissionDate: new Date('2024-02-28'), notes: 'COPD, requires oxygen', isActive: true, sucursal: 'Casa 2' },
    { firstName: 'Elena', lastName: 'Sánchez', cedula: '78901234', admissionDate: new Date('2023-05-10'), notes: 'Osteoporosis, hip fracture history', isActive: true, sucursal: 'Casa 3' },
    { firstName: 'Miguel', lastName: 'Torres', cedula: '89012345', admissionDate: new Date('2024-04-20'), notes: 'Epilepsy, controlled', isActive: true, sucursal: 'Casa 3' },
    { firstName: 'Lucía', lastName: 'Ramírez', cedula: '90123456', admissionDate: new Date('2023-12-05'), notes: 'Hypertension, kidney disease', isActive: true, sucursal: 'Casa 3' },
    { firstName: 'Pedro', lastName: 'Oliveri', cedula: '01234567', admissionDate: new Date('2024-07-12'), notes: 'Post-stroke rehabilitation', isActive: false, sucursal: 'Casa 1' }
  ]);
  console.log('10 Residents created');

  // 3. Create 10 Medications
  const medications = await Medication.insertMany([
    { genericName: 'Losartan', commercialName: 'Cozaar', dosageUnit: 'mg', form: 'tablet', description: 'Antihypertensive', isActive: true },
    { genericName: 'Metformina', commercialName: 'Glucophage', dosageUnit: 'mg', form: 'tablet', description: 'Antidiabetic', isActive: true },
    { genericName: 'Atorvastatina', commercialName: 'Lipitor', dosageUnit: 'mg', form: 'tablet', description: 'Cholesterol lowering', isActive: true },
    { genericName: 'Donepecilo', commercialName: 'Aricept', dosageUnit: 'mg', form: 'tablet', description: 'Alzheimer treatment', isActive: true },
    { genericName: 'Escitalopram', commercialName: 'Lexapro', dosageUnit: 'mg', form: 'tablet', description: 'Antidepressant SSRI', isActive: true },
    { genericName: 'Omeprazol', commercialName: 'Prilosec', dosageUnit: 'mg', form: 'capsule', description: 'Proton pump inhibitor', isActive: true },
    { genericName: 'Levodopa', commercialName: 'Sinemet', dosageUnit: 'mg', form: 'tablet', description: 'Parkinson treatment', isActive: true },
    { genericName: 'Clonazepam', commercialName: 'Rivotril', dosageUnit: 'mg', form: 'tablet', description: 'Anticonvulsant, anxiolytic', isActive: true },
    { genericName: 'Furosemida', commercialName: 'Lasix', dosageUnit: 'mg', form: 'tablet', description: 'Loop diuretic', isActive: true },
    { genericName: 'Salbutamol', commercialName: 'Ventolin', dosageUnit: 'mcg', form: 'inhaler', description: 'Bronchodilator', isActive: true }
  ]);
  console.log('10 Medications created');

  // 4. Create ResidentMedications (assign meds to residents with varying stock levels)
  const assignments = [
    // María - Losartan, Metformina, Atorvastatina
    { resident: residents[0]._id, medication: medications[0]._id, dosageMg: 50, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 }, currentStock: 40 },
    { resident: residents[0]._id, medication: medications[1]._id, dosageMg: 850, schedule: { breakfast: 1, lunch: 1, snack: 0, dinner: 1 }, currentStock: 15 },
    { resident: residents[0]._id, medication: medications[2]._id, dosageMg: 20, schedule: { breakfast: 0, lunch: 0, snack: 0, dinner: 1 }, currentStock: 30 },
    // Jorge - Donepecilo, Clonazepam
    { resident: residents[1]._id, medication: medications[3]._id, dosageMg: 5, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 }, currentStock: 8 },
    { resident: residents[1]._id, medication: medications[7]._id, dosageMg: 2, schedule: { breakfast: 0, lunch: 0, snack: 0, dinner: 1 }, currentStock: 22 },
    // Rosa - Losartan, Furosemida, Atorvastatina
    { resident: residents[2]._id, medication: medications[0]._id, dosageMg: 100, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 25 },
    { resident: residents[2]._id, medication: medications[8]._id, dosageMg: 20, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 3 },
    { resident: residents[2]._id, medication: medications[2]._id, dosageMg: 40, schedule: { breakfast: 0, lunch: 0, snack: 0, dinner: 1 }, currentStock: 28 },
    // Carlos - Levodopa
    { resident: residents[3]._id, medication: medications[6]._id, dosageMg: 250, schedule: { breakfast: 1, lunch: 1, snack: 0, dinner: 1 }, currentStock: 45 },
    // Ana - Escitalopram, Clonazepam
    { resident: residents[4]._id, medication: medications[4]._id, dosageMg: 20, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 18 },
    { resident: residents[4]._id, medication: medications[7]._id, dosageMg: 0.5, schedule: { breakfast: 0, lunch: 0, snack: 0, dinner: 1 }, currentStock: 10 },
    // Roberto - Salbutamol, Omeprazol
    { resident: residents[5]._id, medication: medications[9]._id, dosageMg: 100, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 }, currentStock: 12 },
    { resident: residents[5]._id, medication: medications[5]._id, dosageMg: 20, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 30 },
    // Elena - Losartan, Omeprazol
    { resident: residents[6]._id, medication: medications[0]._id, dosageMg: 50, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 20 },
    { resident: residents[6]._id, medication: medications[5]._id, dosageMg: 40, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 5 },
    // Miguel - Clonazepam
    { resident: residents[7]._id, medication: medications[7]._id, dosageMg: 1, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 }, currentStock: 50 },
    // Lucía - Losartan, Furosemida, Omeprazol
    { resident: residents[8]._id, medication: medications[0]._id, dosageMg: 100, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 }, currentStock: 0 },
    { resident: residents[8]._id, medication: medications[8]._id, dosageMg: 40, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 7 },
    { resident: residents[8]._id, medication: medications[5]._id, dosageMg: 20, schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 0 }, currentStock: 14 },
  ];

  const resMeds = await ResidentMedication.insertMany(assignments);
  console.log(`${resMeds.length} Resident Medication assignments created`);

  // 4b. Create MedicationHistory entries for all assignments
  const historyEntries = resMeds.map(rm => ({
    resident: rm.resident,
    residentMedication: rm._id,
    medication: rm.medication,
    action: 'assigned',
    details: {
      dosageMg: rm.dosageMg,
      schedule: rm.schedule
    },
    date: new Date(Date.now() - 14 * 86400000) // 14 days ago
  }));

  // Add some update and deactivation history for variety
  // Simulate a schedule change for María's Metformina 2 months ago
  historyEntries.push({
    resident: residents[0]._id,
    residentMedication: resMeds[1]._id,
    medication: medications[1]._id,
    action: 'updated',
    details: {
      dosageMg: 850,
      schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 },
      notes: 'Reducción de almuerzo por indicación médica'
    },
    date: new Date(Date.now() - 45 * 86400000)
  });

  // Simulate a previous medication for Jorge that was deactivated
  historyEntries.push({
    resident: residents[1]._id,
    residentMedication: resMeds[3]._id,
    medication: medications[3]._id,
    action: 'updated',
    details: {
      dosageMg: 10,
      schedule: { breakfast: 1, lunch: 0, snack: 0, dinner: 1 },
      notes: 'Dosis ajustada de 10mg a 5mg'
    },
    date: new Date(Date.now() - 30 * 86400000)
  });

  await MedicationHistory.insertMany(historyEntries);
  console.log(`${historyEntries.length} Medication history entries created`);

  // 5. Create initial StockMovements for each assignment
  const stockMovements = resMeds.map(rm => ({
    resident: rm.resident,
    residentMedication: rm._id,
    medication: rm.medication,
    type: 'initial',
    quantity: rm.currentStock,
    previousStock: 0,
    newStock: rm.currentStock,
    notes: 'Initial stock on assignment',
    date: new Date(Date.now() - 7 * 86400000) // 7 days ago
  }));
  await StockMovement.insertMany(stockMovements);
  console.log(`${stockMovements.length} Initial stock movements created`);

  // 6. Create 10 Deliveries (spread across residents)
  const deliveries = [];

  // Delivery 1 - María, 5 days ago
  deliveries.push({
    resident: residents[0]._id,
    deliveredBy: 'Juan González (hijo)',
    deliveryDate: new Date(Date.now() - 5 * 86400000),
    items: [
      { medication: medications[0]._id, residentMedication: resMeds[0]._id, quantity: 30 },
      { medication: medications[1]._id, residentMedication: resMeds[1]._id, quantity: 60 }
    ],
    notes: 'Monthly delivery'
  });

  // Delivery 2 - Jorge, 4 days ago
  deliveries.push({
    resident: residents[1]._id,
    deliveredBy: 'Marta Martínez (hija)',
    deliveryDate: new Date(Date.now() - 4 * 86400000),
    items: [
      { medication: medications[3]._id, residentMedication: resMeds[3]._id, quantity: 30 }
    ],
    notes: 'Donepecilo refill'
  });

  // Delivery 3 - Rosa, 3 days ago
  deliveries.push({
    resident: residents[2]._id,
    deliveredBy: 'Fernando López (esposo)',
    deliveryDate: new Date(Date.now() - 3 * 86400000),
    items: [
      { medication: medications[0]._id, residentMedication: resMeds[5]._id, quantity: 30 },
      { medication: medications[8]._id, residentMedication: resMeds[6]._id, quantity: 20 },
      { medication: medications[2]._id, residentMedication: resMeds[7]._id, quantity: 30 }
    ],
    notes: 'All medications for the month'
  });

  // Delivery 4 - Carlos, 3 days ago
  deliveries.push({
    resident: residents[3]._id,
    deliveredBy: 'Laura Fernández (hija)',
    deliveryDate: new Date(Date.now() - 3 * 86400000),
    items: [
      { medication: medications[6]._id, residentMedication: resMeds[8]._id, quantity: 90 }
    ],
    notes: 'Levodopa 3-month supply'
  });

  // Delivery 5 - Ana, 2 days ago
  deliveries.push({
    resident: residents[4]._id,
    deliveredBy: 'Sofía Rodríguez (hermana)',
    deliveryDate: new Date(Date.now() - 2 * 86400000),
    items: [
      { medication: medications[4]._id, residentMedication: resMeds[9]._id, quantity: 30 },
      { medication: medications[7]._id, residentMedication: resMeds[10]._id, quantity: 30 }
    ],
    notes: 'Escitalopram + Clonazepam'
  });

  // Delivery 6 - Roberto, 2 days ago
  deliveries.push({
    resident: residents[5]._id,
    deliveredBy: 'Andrés Díaz (hijo)',
    deliveryDate: new Date(Date.now() - 2 * 86400000),
    items: [
      { medication: medications[9]._id, residentMedication: resMeds[11]._id, quantity: 1 }
    ],
    notes: 'New Ventolin inhaler'
  });

  // Delivery 7 - Elena, 1 day ago
  deliveries.push({
    resident: residents[6]._id,
    deliveredBy: 'Ricardo Sánchez (hijo)',
    deliveryDate: new Date(Date.now() - 1 * 86400000),
    items: [
      { medication: medications[0]._id, residentMedication: resMeds[13]._id, quantity: 30 },
      { medication: medications[5]._id, residentMedication: resMeds[14]._id, quantity: 30 }
    ],
    notes: 'Monthly delivery, Omeprazol was running low'
  });

  // Delivery 8 - Miguel, 1 day ago
  deliveries.push({
    resident: residents[7]._id,
    deliveredBy: 'Isabel Torres (esposa)',
    deliveryDate: new Date(Date.now() - 1 * 86400000),
    items: [
      { medication: medications[7]._id, residentMedication: resMeds[15]._id, quantity: 60 }
    ],
    notes: 'Clonazepam 2-month supply'
  });

  // Delivery 9 - Lucía, today
  deliveries.push({
    resident: residents[8]._id,
    deliveredBy: 'Diego Ramírez (nieto)',
    deliveryDate: new Date(),
    items: [
      { medication: medications[0]._id, residentMedication: resMeds[16]._id, quantity: 30 },
      { medication: medications[8]._id, residentMedication: resMeds[17]._id, quantity: 30 }
    ],
    notes: 'Urgent: Losartan was at 0'
  });

  // Delivery 10 - María, today
  deliveries.push({
    resident: residents[0]._id,
    deliveredBy: 'Juan González (hijo)',
    deliveryDate: new Date(),
    items: [
      { medication: medications[2]._id, residentMedication: resMeds[2]._id, quantity: 30 }
    ],
    notes: 'Atorvastatina refill'
  });

  const createdDeliveries = await Delivery.insertMany(deliveries);
  console.log('10 Deliveries created');

  // 7. Create delivery stock movements
  const deliveryMovements = [];
  for (const delivery of createdDeliveries) {
    for (const item of delivery.items) {
      deliveryMovements.push({
        resident: delivery.resident,
        residentMedication: item.residentMedication,
        medication: item.medication,
        type: 'delivery',
        quantity: item.quantity,
        previousStock: 0,
        newStock: item.quantity,
        notes: `Delivery by ${delivery.deliveredBy}`,
        date: delivery.deliveryDate
      });
    }
  }
  await StockMovement.insertMany(deliveryMovements);
  console.log(`${deliveryMovements.length} Delivery stock movements created`);

  // 8. Create some daily deduction movements
  const deductionMovements = [];
  for (const rm of resMeds) {
    const daily = (rm.schedule.breakfast || 0) + (rm.schedule.lunch || 0) +
                  (rm.schedule.snack || 0) + (rm.schedule.dinner || 0);
    if (daily > 0 && rm.currentStock > 0) {
      // Simulate 3 days of deductions
      for (let d = 3; d >= 1; d--) {
        deductionMovements.push({
          resident: rm.resident,
          residentMedication: rm._id,
          medication: rm.medication,
          type: 'daily_deduction',
          quantity: -daily,
          previousStock: rm.currentStock + (daily * d),
          newStock: rm.currentStock + (daily * (d - 1)),
          notes: 'Automatic daily deduction',
          date: new Date(Date.now() - d * 86400000)
        });
      }
    }
  }
  await StockMovement.insertMany(deductionMovements);
  console.log(`${deductionMovements.length} Daily deduction movements created`);

  // 9. Create Notifications
  const notifications = [
    {
      type: 'out_of_stock',
      title: 'Out of Stock: Losartan',
      message: 'Lucía Ramírez has run out of Losartan (100mg). Please request a delivery.',
      resident: residents[8]._id,
      medication: medications[0]._id,
      isRead: false,
      data: { daysRemaining: 0 }
    },
    {
      type: 'low_stock',
      title: 'Low Stock: Furosemida',
      message: 'Rosa López has only 3 day(s) of Furosemida (20mg) remaining. Current stock: 3.',
      resident: residents[2]._id,
      medication: medications[8]._id,
      isRead: false,
      data: { daysRemaining: 3 }
    },
    {
      type: 'low_stock',
      title: 'Low Stock: Donepecilo',
      message: 'Jorge Martínez has only 4 day(s) of Donepecilo (5mg) remaining. Current stock: 8.',
      resident: residents[1]._id,
      medication: medications[3]._id,
      isRead: false,
      data: { daysRemaining: 4 }
    },
    {
      type: 'low_stock',
      title: 'Low Stock: Metformina',
      message: 'María González has only 5 day(s) of Metformina (850mg) remaining. Current stock: 15.',
      resident: residents[0]._id,
      medication: medications[1]._id,
      isRead: false,
      data: { daysRemaining: 5 }
    },
    {
      type: 'low_stock',
      title: 'Low Stock: Omeprazol',
      message: 'Elena Sánchez has only 5 day(s) of Omeprazol (40mg) remaining. Current stock: 5.',
      resident: residents[6]._id,
      medication: medications[5]._id,
      isRead: true,
      data: { daysRemaining: 5 }
    },
    {
      type: 'delivery',
      title: 'New Delivery: Lucía Ramírez',
      message: 'Diego Ramírez delivered Losartan and Furosemida for Lucía Ramírez.',
      resident: residents[8]._id,
      isRead: false
    },
    {
      type: 'delivery',
      title: 'New Delivery: María González',
      message: 'Juan González delivered Atorvastatina for María González.',
      resident: residents[0]._id,
      isRead: true
    },
    {
      type: 'medication_change',
      title: 'Medication Change: Carlos Fernández',
      message: 'Levodopa dosage schedule was updated for Carlos Fernández.',
      resident: residents[3]._id,
      medication: medications[6]._id,
      isRead: true
    },
    {
      type: 'low_stock',
      title: 'Low Stock: Salbutamol',
      message: 'Roberto Díaz has only 6 day(s) of Salbutamol remaining. Current stock: 12.',
      resident: residents[5]._id,
      medication: medications[9]._id,
      isRead: false,
      data: { daysRemaining: 6 }
    },
    {
      type: 'general',
      title: 'System Notice',
      message: 'Daily stock deduction completed successfully for all active medications.',
      isRead: true
    }
  ];

  await Notification.insertMany(notifications);
  console.log('10 Notifications created');

  console.log('\n--- Seed Summary ---');
  console.log('Settings: 1');
  console.log('Residents: 10 (9 active, 1 inactive)');
  console.log('Medications: 10');
  console.log(`Resident Medications: ${resMeds.length}`);
  console.log('Deliveries: 10');
  console.log(`Stock Movements: ${stockMovements.length + deliveryMovements.length + deductionMovements.length}`);
  console.log('Notifications: 10 (5 unread)');
  console.log('\nSeed completed successfully!');

  await mongoose.disconnect();
};

seed().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
