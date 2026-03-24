const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadExpensePhoto } = require('../middleware/upload');
const {
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
  getPayments,
  createPayment,
  deletePayment,
  getDebtors,
  getSummary,
  getAdjustmentAlerts,
  getStatementsMonthly,
  toggleStatementLock,
  generateStatementPDFRoute,
  generateAllStatementsPDFRoute,
  generateSummaryPDFRoute,
  generateDebtorsPDFRoute,
  deleteStatement,
  loadRecurringExpenses
} = require('../controllers/billingController');

router.use(protect);

// Billing config
router.get('/configs', getAllConfigs);
router.get('/config/:residentId', getBillingConfig);
router.post('/config/:residentId', upsertBillingConfig);

// Expenses
router.get('/expenses/:residentId', getExpenses);
router.post('/expenses/:residentId', (req, res, next) => {
  uploadExpensePhoto(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, createExpense);
router.put('/expenses/:expenseId', (req, res, next) => {
  uploadExpensePhoto(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, updateExpense);
router.delete('/expenses/:expenseId', deleteExpense);
router.post('/expenses/:residentId/load-recurring', loadRecurringExpenses);

// Statements
router.get('/statements/:residentId', getStatements);
router.get('/statements/:residentId/:month/:year', getStatement);
router.post('/statements/:residentId', createStatement);
router.put('/statements/:statementId', updateStatement);
router.delete('/statements/:statementId', deleteStatement);
router.put('/statements/:statementId/toggle-lock', toggleStatementLock);

// Payments
router.get('/payments/:statementId', getPayments);
router.post('/payments/:statementId', createPayment);
router.delete('/payments/:paymentId', deletePayment);

// Aggregated
router.get('/debtors', getDebtors);
router.get('/summary', getSummary);
router.get('/statements-monthly', getStatementsMonthly);
router.get('/adjustment-alerts', getAdjustmentAlerts);

// PDF
router.get('/pdf/statement/:residentId/:month/:year', generateStatementPDFRoute);
router.get('/pdf/statements-all/:month/:year', generateAllStatementsPDFRoute);
router.get('/pdf/summary/:month/:year', generateSummaryPDFRoute);
router.get('/pdf/debtors/:month/:year', generateDebtorsPDFRoute);

module.exports = router;
