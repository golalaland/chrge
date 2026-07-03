/**
 * index.js — Cloud Functions entry point
 * ------------------------------------------------------------
 * CHRGE Verify backend. Deploy with:
 *   firebase deploy --only functions
 *
 * Every function here uses the v2 (onCall/onRequest) API, which
 * gives better cold-start and concurrency behavior than v1 —
 * matters once you're at the "millions of products" scale this
 * spec targets.
 * ------------------------------------------------------------
 */

const { initializeApp } = require('firebase-admin/app');
initializeApp();

// Admin provisioning
const { bootstrapFirstAdmin, provisionAdmin, revokeAdmin } = require('./src/adminFunctions');

// Product Manager
const { createProduct, updateProduct } = require('./src/productFunctions');

// Batch Manager + secure code generation
const { createBatch, listBatches } = require('./src/batchFunctions');

// Dashboard
const { getDashboardStats } = require('./src/dashboardFunctions');

// Public verification portal backend
const { verifyCode } = require('./src/verifyFunctions');

module.exports = {
  // Admin
  bootstrapFirstAdmin,
  provisionAdmin,
  revokeAdmin,

  // Products
  createProduct,
  updateProduct,

  // Batches + codes
  createBatch,
  listBatches,

  // Dashboard
  getDashboardStats,

  // Public verification
  verifyCode
};

// ============================================================
// NOT YET IMPLEMENTED IN THIS PASS — see README for the
// staged build plan. Wiring these in later is additive; the
// data model and Firestore rules already account for them:
//
//   disableCode / reissueCode / blacklistCode  (code actions)
//   generatePrintSheet  (variable-data PDF generation)
//   getScanHistory      (per-code scan detail for admin UI)
// ============================================================
