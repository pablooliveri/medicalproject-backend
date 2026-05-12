/**
 * One-shot migration: backfill / repair MonthlyStatement docs for an institution / month / year.
 *
 * Why: in older code paths the bulk-PDF route didn't persist statements, and the
 * recalculateStatement helper didn't set `institution` when creating new docs. Result:
 * (a) some months have no statement at all for residents that should, and
 * (b) some statements exist but with `institution: null` (orphans), invisible to the
 * tenant-scoped queries used by getDebtors / getSummary.
 *
 * This script:
 *   - Adopts orphan statements into the given institution
 *   - Refreshes monthlyFee / totalExpenses / totalAmount / balance from current data
 *   - Creates statements for residents that don't have one yet
 *   - Skips locked statements (they were intentionally frozen) and skips residents with
 *     no fee and no expenses (no point materializing a $0 statement)
 *
 * Idempotent — re-running is safe.
 *
 * Usage:
 *   node _migrate_month.js <institutionId> <month> <year>
 *
 * Example:
 *   node _migrate_month.js 69c5e566780239eb75ae1933 5 2026
 *
 * Remove this file once Pablo's data is migrated.
 */

require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Institution');
const Resident = require('./models/Resident');
const BillingConfig = require('./models/BillingConfig');
const Expense = require('./models/Expense');
const MonthlyStatement = require('./models/MonthlyStatement');
const Payment = require('./models/Payment');

const INSTITUTION_ID = process.argv[2];
const MONTH = Number(process.argv[3]);
const YEAR = Number(process.argv[4]);

if (!INSTITUTION_ID || !MONTH || !YEAR) {
  console.log('Usage: node _migrate_month.js <institutionId> <month> <year>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const residents = await Resident.find({ institution: INSTITUTION_ID, isActive: true });
  console.log(`Active residents in institution: ${residents.length}`);

  let created = 0;
  let adopted = 0;
  let updated = 0;
  let skippedLocked = 0;
  let skippedEmpty = 0;
  let skippedWrongTenant = 0;

  for (const r of residents) {
    // BillingConfig.resident is globally unique — no need to filter by institution
    const config = await BillingConfig.findOne({ resident: r._id });
    const monthlyFee = config ? config.monthlyFee : 0;

    // Expenses for this resident in this period (no institution filter — resident is institution-scoped)
    const expenses = await Expense.find({ resident: r._id, month: MONTH, year: YEAR });
    const totalExpenses = expenses.reduce(
      (s, e) => s + ((e.unitPrice || 0) * (e.quantity || 1)),
      0
    );

    // Find by resident/month/year (no institution filter) so we can adopt orphans
    let stmt = await MonthlyStatement.findOne({ resident: r._id, month: MONTH, year: YEAR });

    const payments = stmt ? await Payment.find({ statement: stmt._id }) : [];
    const amountPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

    const totalAmount = monthlyFee + totalExpenses;
    const balance = totalAmount - amountPaid;
    const status = balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

    if (!stmt) {
      if (monthlyFee === 0 && totalExpenses === 0) {
        skippedEmpty++;
        continue;
      }
      await MonthlyStatement.create({
        resident: r._id,
        institution: INSTITUTION_ID,
        month: MONTH,
        year: YEAR,
        monthlyFee,
        totalExpenses,
        totalAmount,
        amountPaid,
        balance,
        status
      });
      created++;
      continue;
    }

    // Guard: existing statement belongs to a different tenant — don't touch
    if (stmt.institution && String(stmt.institution) !== INSTITUTION_ID) {
      console.warn(`SKIP wrong tenant: ${r.firstName} ${r.lastName} (stmt._id=${stmt._id})`);
      skippedWrongTenant++;
      continue;
    }

    if (stmt.locked) {
      // Locked statements are frozen — only fill in missing institution, don't touch financials
      if (!stmt.institution) {
        stmt.institution = INSTITUTION_ID;
        await stmt.save();
        adopted++;
      } else {
        skippedLocked++;
      }
      continue;
    }

    const wasOrphan = !stmt.institution;
    if (wasOrphan) stmt.institution = INSTITUTION_ID;
    stmt.monthlyFee = monthlyFee;
    stmt.totalExpenses = totalExpenses;
    stmt.totalAmount = totalAmount;
    stmt.amountPaid = amountPaid;
    stmt.balance = balance;
    stmt.status = status;
    await stmt.save();

    if (wasOrphan) adopted++;
    else updated++;
  }

  console.log('---');
  console.log(`Created:           ${created}`);
  console.log(`Adopted (orphan):  ${adopted}`);
  console.log(`Updated:           ${updated}`);
  console.log(`Skipped (locked):  ${skippedLocked}`);
  console.log(`Skipped (empty):   ${skippedEmpty}`);
  console.log(`Skipped (wrong tenant): ${skippedWrongTenant}`);
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
