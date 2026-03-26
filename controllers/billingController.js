const BillingConfig = require('../models/BillingConfig');
const Expense = require('../models/Expense');
const MonthlyStatement = require('../models/MonthlyStatement');
const Payment = require('../models/Payment');
const Resident = require('../models/Resident');
const { generateStatementPDF, generateAllStatementsPDF, generateLedgerPDF, FULL_MONTH_NAMES_ES } = require('../utils/pdfGenerator');
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require('../utils/cloudinary');

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Recalculates totals and balance for a MonthlyStatement.
 * Creates the statement if it doesn't exist yet.
 */
const recalculateStatement = async (residentId, month, year) => {
  // Sum all expenses for this resident/month/year
  const expenses = await Expense.find({ resident: residentId, month, year });
  const totalExpenses = expenses.reduce((sum, e) => sum + ((e.unitPrice || 0) * (e.quantity || 1)), 0);

  // Always get current config to use latest monthlyFee
  const config = await BillingConfig.findOne({ resident: residentId });
  const currentMonthlyFee = config ? config.monthlyFee : 0;

  // Get or create statement
  let statement = await MonthlyStatement.findOne({ resident: residentId, month, year });

  if (!statement) {
    statement = new MonthlyStatement({
      resident: residentId,
      month,
      year,
      monthlyFee: currentMonthlyFee
    });
  } else {
    // Update monthlyFee from config in case it changed
    statement.monthlyFee = currentMonthlyFee;
  }

  // Sum all payments for this statement
  const payments = await Payment.find({ statement: statement._id });
  const amountPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  statement.totalExpenses = totalExpenses;
  statement.totalAmount = statement.monthlyFee + totalExpenses;
  statement.amountPaid = amountPaid;
  statement.balance = statement.totalAmount - amountPaid;
  statement.status = statement.balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

  await statement.save();
  return statement;
};

// ─── BillingConfig ────────────────────────────────────────────────────────────

// GET /api/billing/config/:residentId
const getBillingConfig = async (req, res) => {
  try {
    let config = await BillingConfig.findOne({ resident: req.params.residentId });
    if (!config) {
      config = await BillingConfig.create({
        resident: req.params.residentId,
        monthlyFee: 0,
        adjustmentPercentage: 0,
        adjustmentMonths: [],
        notes: '',
        recurringExpenses: []
      });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/billing/config/:residentId  (upsert)
const upsertBillingConfig = async (req, res) => {
  try {
    const { monthlyFee, adjustmentPercentage, adjustmentMonths, notes, recurringExpenses } = req.body;

    if (monthlyFee !== undefined && monthlyFee < 0) {
      return res.status(400).json({ message: 'Monthly fee cannot be negative' });
    }
    if (adjustmentPercentage !== undefined && (adjustmentPercentage < 0 || adjustmentPercentage > 100)) {
      return res.status(400).json({ message: 'Adjustment percentage must be between 0 and 100' });
    }
    if (adjustmentMonths && !adjustmentMonths.every(m => m >= 1 && m <= 12)) {
      return res.status(400).json({ message: 'Invalid adjustment months' });
    }

    const config = await BillingConfig.findOneAndUpdate(
      { resident: req.params.residentId },
      { monthlyFee, adjustmentPercentage, adjustmentMonths, notes, ...(recurringExpenses !== undefined ? { recurringExpenses } : {}) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

// GET /api/billing/expenses/:residentId  ?month=&year=
const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    const query = { resident: req.params.residentId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const expenses = await Expense.find(query).sort({ createdAt: 1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: check if month is locked for a resident
const isMonthLocked = async (residentId, month, year) => {
  const stmt = await MonthlyStatement.findOne({ resident: residentId, month, year });
  return stmt && stmt.locked;
};

// POST /api/billing/expenses/:residentId
const createExpense = async (req, res) => {
  try {
    const { concept, unitPrice, quantity, month, year, notes } = req.body;

    if (!concept || !concept.trim()) {
      return res.status(400).json({ message: 'Concept is required' });
    }
    if (unitPrice === undefined || Number(unitPrice) < 0) {
      return res.status(400).json({ message: 'Unit price must be a non-negative number' });
    }
    if (quantity !== undefined && Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than zero' });
    }
    if (!month || Number(month) < 1 || Number(month) > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12' });
    }

    if (await isMonthLocked(req.params.residentId, Number(month), Number(year))) {
      return res.status(400).json({ message: 'El estado de cuenta de este mes está cerrado. Desbloquealo para agregar gastos.' });
    }

    let photo = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'medical/expenses');
      photo = result.secure_url;
    }

    const expense = await Expense.create({
      resident: req.params.residentId,
      concept,
      unitPrice: Number(unitPrice),
      quantity: Number(quantity) || 1,
      month: Number(month),
      year: Number(year),
      photo,
      notes
    });

    await recalculateStatement(req.params.residentId, Number(month), Number(year));

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/billing/expenses/:expenseId
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (await isMonthLocked(expense.resident, expense.month, expense.year)) {
      return res.status(400).json({ message: 'El estado de cuenta de este mes está cerrado. Desbloquealo para editar gastos.' });
    }

    const { concept, unitPrice, quantity, notes } = req.body;
    if (concept !== undefined) expense.concept = concept;
    if (unitPrice !== undefined) expense.unitPrice = Number(unitPrice);
    if (quantity !== undefined) expense.quantity = Number(quantity);
    if (notes !== undefined) expense.notes = notes;
    if (req.file) {
      if (expense.photo) await deleteFromCloudinary(getPublicIdFromUrl(expense.photo));
      const result = await uploadToCloudinary(req.file.buffer, 'medical/expenses');
      expense.photo = result.secure_url;
    }

    await expense.save();
    await recalculateStatement(expense.resident, expense.month, expense.year);

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/billing/expenses/:expenseId
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (await isMonthLocked(expense.resident, expense.month, expense.year)) {
      return res.status(400).json({ message: 'El estado de cuenta de este mes está cerrado. Desbloquealo para eliminar gastos.' });
    }

    const { resident, month, year } = expense;

    if (expense.photo) {
      await deleteFromCloudinary(getPublicIdFromUrl(expense.photo));
    }

    await Expense.findByIdAndDelete(req.params.expenseId);
    await recalculateStatement(resident, month, year);

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Monthly Statements ───────────────────────────────────────────────────────

// GET /api/billing/statements/:residentId  ?year=
const getStatements = async (req, res) => {
  try {
    const query = { resident: req.params.residentId };
    if (req.query.year) query.year = Number(req.query.year);

    const statements = await MonthlyStatement.find(query).sort({ year: -1, month: -1 });
    res.json(statements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/statements/:residentId/:month/:year
const getStatement = async (req, res) => {
  try {
    const { residentId, month, year } = req.params;
    let statement = await MonthlyStatement.findOne({
      resident: residentId,
      month: Number(month),
      year: Number(year)
    });

    // If no statement yet, return a computed preview
    if (!statement) {
      const config = await BillingConfig.findOne({ resident: residentId });
      const expenses = await Expense.find({ resident: residentId, month: Number(month), year: Number(year) });
      const totalExpenses = expenses.reduce((s, e) => s + ((e.unitPrice || 0) * (e.quantity || 1)), 0);
      let monthlyFee = config ? config.monthlyFee : 0;

      // Include adjustment in preview so it matches what createStatement will produce
      const adjMonths = config?.adjustmentMonths || [];
      const pct = config?.adjustmentPercentage || 0;
      const wouldAdjust = adjMonths.includes(Number(month)) && pct > 0;
      if (wouldAdjust) {
        monthlyFee = Math.round(monthlyFee * (1 + pct / 100));
      }

      return res.json({
        resident: residentId,
        month: Number(month),
        year: Number(year),
        monthlyFee,
        totalExpenses,
        totalAmount: monthlyFee + totalExpenses,
        amountPaid: 0,
        balance: monthlyFee + totalExpenses,
        status: 'pending',
        adjustmentApplied: false,
        pendingAdjustment: wouldAdjust,
        adjustmentPercentage: wouldAdjust ? pct : 0,
        isPreview: true
      });
    }

    res.json(statement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/billing/statements/:residentId  — create/lock statement for a month
const createStatement = async (req, res) => {
  try {
    const { month, year, applyAdjustment, adjustmentPercentage: bodyPercentage } = req.body;
    const residentId = req.params.residentId;

    const config = await BillingConfig.findOne({ resident: residentId });
    let monthlyFee = config ? config.monthlyFee : 0;
    let adjustmentApplied = false;

    // Apply adjustment: use percentage from body (user-entered) if provided, else fall back to config
    const pct = bodyPercentage !== undefined ? Number(bodyPercentage) : (config?.adjustmentPercentage || 0);
    if (applyAdjustment && pct > 0) {
      monthlyFee = Math.round(monthlyFee * (1 + pct / 100));
      adjustmentApplied = true;

      // Update the config's monthly fee for future months
      if (config) {
        config.monthlyFee = monthlyFee;
        await config.save();
      }
    }

    // Upsert statement
    const expenses = await Expense.find({ resident: residentId, month: Number(month), year: Number(year) });
    const totalExpenses = expenses.reduce((s, e) => s + ((e.unitPrice || 0) * (e.quantity || 1)), 0);
    const totalAmount = monthlyFee + totalExpenses;

    const statement = await MonthlyStatement.findOneAndUpdate(
      { resident: residentId, month: Number(month), year: Number(year) },
      { monthlyFee, totalExpenses, totalAmount, adjustmentApplied, balance: totalAmount, status: 'pending' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(statement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/billing/statements/:statementId  — recalculate
const updateStatement = async (req, res) => {
  try {
    const statement = await MonthlyStatement.findById(req.params.statementId);
    if (!statement) return res.status(404).json({ message: 'Statement not found' });

    if (req.body.notes !== undefined) statement.notes = req.body.notes;
    if (req.body.addenda !== undefined) statement.addenda = req.body.addenda;
    if (req.body.monthlyFee !== undefined) {
      statement.monthlyFee = Number(req.body.monthlyFee);
    }

    await statement.save();
    const updated = await recalculateStatement(statement.resident, statement.month, statement.year);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/billing/statements/:statementId
const deleteStatement = async (req, res) => {
  try {
    const statement = await MonthlyStatement.findById(req.params.statementId);
    if (!statement) return res.status(404).json({ message: 'Statement not found' });

    // Delete all payments and expenses for this statement's month/year/resident
    await Payment.deleteMany({ statement: statement._id });
    await Expense.deleteMany({ resident: statement.resident, month: statement.month, year: statement.year });
    await statement.deleteOne();

    res.json({ message: 'Statement deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/billing/expenses/:residentId/load-recurring
const loadRecurringExpenses = async (req, res) => {
  try {
    const { month, year } = req.body;
    const residentId = req.params.residentId;

    if (await isMonthLocked(residentId, Number(month), Number(year))) {
      return res.status(400).json({ message: 'El estado de cuenta de este mes está cerrado.' });
    }

    const config = await BillingConfig.findOne({ resident: residentId });
    if (!config || !config.recurringExpenses || !config.recurringExpenses.length) {
      return res.json({ created: 0, message: 'No recurring expenses configured' });
    }

    let created = 0;
    for (const rec of config.recurringExpenses) {
      const exists = await Expense.findOne({ resident: residentId, month: Number(month), year: Number(year), concept: rec.concept });
      if (!exists) {
        await Expense.create({
          resident: residentId,
          concept: rec.concept,
          unitPrice: rec.unitPrice,
          quantity: rec.quantity,
          month: Number(month),
          year: Number(year)
        });
        created++;
      }
    }

    await recalculateStatement(residentId, Number(month), Number(year));
    res.json({ created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Payments ─────────────────────────────────────────────────────────────────

// GET /api/billing/payments/:statementId
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ statement: req.params.statementId }).sort({ paymentDate: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/billing/payments/:statementId
const createPayment = async (req, res) => {
  try {
    const statement = await MonthlyStatement.findById(req.params.statementId);
    if (!statement) return res.status(404).json({ message: 'Statement not found' });

    const { amount, paymentDate, method, notes } = req.body;
    const payment = await Payment.create({
      statement: statement._id,
      resident: statement.resident,
      amount: Number(amount),
      paymentDate: paymentDate || new Date(),
      method: method || 'cash',
      notes
    });

    await recalculateStatement(statement.resident, statement.month, statement.year);

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/billing/payments/:paymentId
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const statement = await MonthlyStatement.findById(payment.statement);
    await Payment.findByIdAndDelete(req.params.paymentId);

    if (statement) {
      await recalculateStatement(statement.resident, statement.month, statement.year);
    }

    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Aggregated ───────────────────────────────────────────────────────────────

// GET /api/billing/debtors  ?sucursal=&month=&year=
const getDebtors = async (req, res) => {
  try {
    const { sucursal, month, year } = req.query;
    const query = { balance: { $gt: 0 } };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const statements = await MonthlyStatement.find(query)
      .populate('resident')
      .sort({ balance: -1 });

    // Filter by sucursal after populate
    const filtered = sucursal
      ? statements.filter(s => s.resident && s.resident.sucursal === sucursal)
      : statements.filter(s => s.resident);

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/summary  ?sucursal=&month=&year=
const getSummary = async (req, res) => {
  try {
    const { sucursal, month, year } = req.query;

    // Get active residents (optionally filtered by sucursal)
    const residentQuery = { isActive: true };
    if (sucursal) residentQuery.sucursal = sucursal;
    const residents = await Resident.find(residentQuery).select('_id');
    const residentIds = residents.map(r => r._id);

    // Get existing statements for this month/year
    const stmtQuery = {};
    if (month) stmtQuery.month = Number(month);
    if (year) stmtQuery.year = Number(year);
    const statements = await MonthlyStatement.find(stmtQuery).populate('resident');

    const filtered = sucursal
      ? statements.filter(s => s.resident && s.resident.sucursal === sucursal)
      : statements.filter(s => s.resident);

    // Build set of residents that already have statements
    const residentsWithStatements = new Set(filtered.map(s => s.resident._id.toString()));

    // For residents WITHOUT statements, project from their billing config
    const residentsWithoutStatements = residentIds.filter(id => !residentsWithStatements.has(id.toString()));
    let projectedFees = 0;
    let projectedCount = 0;
    if (residentsWithoutStatements.length > 0 && month && year) {
      const configs = await BillingConfig.find({ resident: { $in: residentsWithoutStatements } });
      for (const c of configs) {
        if (c.monthlyFee > 0) {
          const expenses = await Expense.find({ resident: c.resident, month: Number(month), year: Number(year) });
          const totalExp = expenses.reduce((sum, e) => sum + ((e.unitPrice || 0) * (e.quantity || 1)), 0);
          projectedFees += c.monthlyFee + totalExp;
          projectedCount++;
        }
      }
    }

    const summary = {
      totalBilled: 0,
      totalFees: 0,
      totalExpenses: 0,
      totalPaid: 0,
      totalPending: 0,
      residentCount: filtered.length,
      activeResidentCount: residentIds.length,
      debtorCount: 0
    };

    for (const s of filtered) {
      summary.totalBilled += s.totalAmount || 0;
      summary.totalFees += s.monthlyFee || 0;
      summary.totalExpenses += s.totalExpenses || 0;
      summary.totalPaid += s.amountPaid || 0;
      summary.totalPending += s.balance || 0;
      if (s.balance > 0) summary.debtorCount++;
    }

    // Add projected billing from configs for residents without statements
    summary.totalBilled += projectedFees;
    summary.totalFees += projectedFees;
    summary.totalPending += projectedFees;
    summary.residentCount += projectedCount;

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/statements-monthly  ?sucursal=&month=&year=
const getStatementsMonthly = async (req, res) => {
  try {
    const { sucursal, month, year } = req.query;
    const query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const statements = await MonthlyStatement.find(query)
      .populate('resident')
      .sort({ 'resident.lastName': 1 });

    const filtered = sucursal
      ? statements.filter(s => s.resident && s.resident.sucursal === sucursal)
      : statements.filter(s => s.resident);

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/adjustment-alerts
const getAdjustmentAlerts = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const configs = await BillingConfig.find({ adjustmentMonths: currentMonth })
      .populate('resident');

    const alerts = configs.filter(c => c.resident && c.resident.isActive);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/configs  — all residents with their billing config
const getAllConfigs = async (req, res) => {
  try {
    const residents = await Resident.find({ isActive: true }).sort({ lastName: 1, firstName: 1 });
    const configs = await BillingConfig.find({});
    const configMap = {};
    configs.forEach(c => { if (c.resident) configMap[c.resident.toString()] = c; });

    const result = residents.map(r => ({
      resident: r,
      config: configMap[r._id.toString()] || {
        monthlyFee: 0,
        adjustmentPercentage: 0,
        adjustmentMonths: [],
        notes: ''
      }
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PDF Reports ──────────────────────────────────────────────────────────────

// GET /api/billing/pdf/statement/:residentId/:month/:year
const generateStatementPDFRoute = async (req, res) => {
  try {
    const { residentId, month, year } = req.params;

    const resident = await Resident.findById(residentId);
    if (!resident) return res.status(404).json({ message: 'Resident not found' });

    let statement = await MonthlyStatement.findOne({
      resident: residentId,
      month: Number(month),
      year: Number(year)
    });

    if (!statement) {
      // Generate a preview without saving to DB
      const config = await BillingConfig.findOne({ resident: residentId });
      const previewExpenses = await Expense.find({ resident: residentId, month: Number(month), year: Number(year) });
      const totalExpenses = previewExpenses.reduce((s, e) => s + ((e.unitPrice || 0) * (e.quantity || 1)), 0);
      const monthlyFee = config ? config.monthlyFee : 0;
      statement = {
        month: Number(month),
        year: Number(year),
        monthlyFee,
        totalExpenses,
        totalAmount: monthlyFee + totalExpenses,
        amountPaid: 0,
        balance: monthlyFee + totalExpenses,
        status: 'pending'
      };
    }

    const expenses = await Expense.find({
      resident: residentId,
      month: Number(month),
      year: Number(year)
    }).sort({ createdAt: 1 });

    const payments = statement._id
      ? await Payment.find({ statement: statement._id }).sort({ paymentDate: 1 })
      : [];

    const pdfBuffer = await generateStatementPDF(resident, statement, expenses, payments);

    const monthName = FULL_MONTH_NAMES_ES[Number(month) - 1];
    const filename = `${resident.firstName}-${resident.lastName}-${monthName}-${year}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/pdf/statements-all/:month/:year  ?sucursal=
const generateAllStatementsPDFRoute = async (req, res) => {
  try {
    const { month, year } = req.params;
    const { sucursal } = req.query;

    const residentFilter = { isActive: true };
    if (sucursal) residentFilter.sucursal = sucursal;

    const residents = await Resident.find(residentFilter).sort({ lastName: 1, firstName: 1 });
    if (residents.length === 0) {
      return res.status(404).json({ message: 'No active residents found' });
    }

    const residentsData = [];
    for (const resident of residents) {
      const statement = await MonthlyStatement.findOne({
        resident: resident._id,
        month: Number(month),
        year: Number(year)
      });

      const config = await BillingConfig.findOne({ resident: resident._id });
      let stmtData = statement;

      if (!stmtData) {
        const expenses = await Expense.find({ resident: resident._id, month: Number(month), year: Number(year) });
        const totalExpenses = expenses.reduce((s, e) => s + ((e.unitPrice || 0) * (e.quantity || 1)), 0);
        const monthlyFee = config ? config.monthlyFee : 0;
        stmtData = {
          month: Number(month),
          year: Number(year),
          monthlyFee,
          totalExpenses,
          totalAmount: monthlyFee + totalExpenses,
          amountPaid: 0,
          balance: monthlyFee + totalExpenses
        };
      }

      const expenses = await Expense.find({
        resident: resident._id,
        month: Number(month),
        year: Number(year)
      }).sort({ createdAt: 1 });

      residentsData.push({ resident, statement: stmtData, expenses });
    }

    const pdfBuffer = await generateAllStatementsPDF(residentsData, { month: Number(month), year: Number(year) });
    const monthName = FULL_MONTH_NAMES_ES[Number(month) - 1];

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="estados-cuenta-${monthName}-${year}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/billing/statements/:statementId/toggle-lock
const toggleStatementLock = async (req, res) => {
  try {
    const statement = await MonthlyStatement.findById(req.params.statementId);
    if (!statement) return res.status(404).json({ message: 'Statement not found' });

    statement.locked = !statement.locked;
    await statement.save();

    res.json({ locked: statement.locked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/billing/lock-month  body: { month, year, locked, sucursal? }
const lockMonth = async (req, res) => {
  try {
    const { month, year, locked, sucursal } = req.body;
    const query = { month: Number(month), year: Number(year) };

    let statements = await MonthlyStatement.find(query).populate('resident');
    if (sucursal) {
      statements = statements.filter(s => s.resident && s.resident.sucursal === sucursal);
    }

    const ids = statements.map(s => s._id);
    await MonthlyStatement.updateMany({ _id: { $in: ids } }, { locked: !!locked });

    res.json({ updated: ids.length, locked: !!locked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/pdf/summary/:month/:year  ?sucursal=
const generateSummaryPDFRoute = async (req, res) => {
  try {
    const { month, year } = req.params;
    const { sucursal } = req.query;
    const query = { month: Number(month), year: Number(year) };

    const statements = await MonthlyStatement.find(query).populate('resident').sort({ 'resident.lastName': 1 });
    const filtered = sucursal
      ? statements.filter(s => s.resident && s.resident.sucursal === sucursal)
      : statements.filter(s => s.resident);

    const pdfBuffer = await generateLedgerPDF(filtered, {
      month: Number(month), year: Number(year), type: 'summary', sucursal
    });

    const monthName = FULL_MONTH_NAMES_ES[Number(month) - 1];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="libro-ventas-${monthName}-${year}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/billing/pdf/debtors/:month/:year  ?sucursal=
const generateDebtorsPDFRoute = async (req, res) => {
  try {
    const { month, year } = req.params;
    const { sucursal } = req.query;
    const query = { month: Number(month), year: Number(year), balance: { $gt: 0 } };

    const statements = await MonthlyStatement.find(query).populate('resident').sort({ balance: -1 });
    const filtered = sucursal
      ? statements.filter(s => s.resident && s.resident.sucursal === sucursal)
      : statements.filter(s => s.resident);

    const pdfBuffer = await generateLedgerPDF(filtered, {
      month: Number(month), year: Number(year), type: 'debtors', sucursal
    });

    const monthName = FULL_MONTH_NAMES_ES[Number(month) - 1];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deudores-${monthName}-${year}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBillingConfig,
  upsertBillingConfig,
  getAllConfigs,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getStatements,
  getStatement,
  createStatement,
  updateStatement,
  deleteStatement,
  loadRecurringExpenses,
  getPayments,
  createPayment,
  deletePayment,
  getDebtors,
  getSummary,
  getAdjustmentAlerts,
  getStatementsMonthly,
  toggleStatementLock,
  lockMonth,
  generateStatementPDFRoute,
  generateAllStatementsPDFRoute,
  generateSummaryPDFRoute,
  generateDebtorsPDFRoute
};
