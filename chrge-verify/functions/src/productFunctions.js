/**
 * productFunctions.js
 * ------------------------------------------------------------
 * Product Manager backend. Products are simple enough that reads
 * happen directly from Firestore (per firestore.rules, admins can
 * read `products` directly) — but writes go through this callable
 * so we can validate input server-side and keep a single source
 * of truth for what a "valid" product record looks like.
 * ------------------------------------------------------------
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAdmin } = require('./adminAuth');

const REQUIRED_FIELDS = ['productName', 'sku', 'brand'];

/**
 * createProduct
 * ------------------------------------------------------------
 * Input: { productName, sku, brand, description, imageURL,
 *          color, capacity, manufacturingDate, expirationDate }
 */
const createProduct = onCall({ region: 'us-central1' }, async (request) => {
  const auth = requireAdmin(request);
  const db = getFirestore();
  const data = request.data || {};

  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || typeof data[field] !== 'string' || data[field].trim().length === 0) {
      throw new HttpsError('invalid-argument', `${field} is required.`);
    }
  }

  // Prevent duplicate SKUs
  const existing = await db.collection('products')
    .where('sku', '==', data.sku.trim())
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new HttpsError('already-exists', `A product with SKU "${data.sku}" already exists.`);
  }

  const productRef = db.collection('products').doc();
  const record = {
    productName: data.productName.trim(),
    sku: data.sku.trim(),
    brand: data.brand.trim(),
    description: data.description ? String(data.description).trim() : '',
    imageURL: data.imageURL || null,
    color: data.color || null,
    capacity: data.capacity || null,
    manufacturingDate: data.manufacturingDate || null,
    expirationDate: data.expirationDate || null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: auth.uid,
    active: true
  };

  await productRef.set(record);

  return { productID: productRef.id, ...record };
});

/**
 * updateProduct — partial update, same validation posture.
 */
const updateProduct = onCall({ region: 'us-central1' }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  const { productID, updates } = request.data || {};

  if (!productID) throw new HttpsError('invalid-argument', 'productID is required.');
  if (!updates || typeof updates !== 'object') {
    throw new HttpsError('invalid-argument', 'updates object is required.');
  }

  const productRef = db.collection('products').doc(productID);
  const snap = await productRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Product not found.');

  // Only allow known, safe fields to be updated this way
  const allowedFields = [
    'productName', 'sku', 'brand', 'description', 'imageURL',
    'color', 'capacity', 'manufacturingDate', 'expirationDate', 'active'
  ];
  const safeUpdates = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) safeUpdates[key] = updates[key];
  }
  safeUpdates.updatedAt = FieldValue.serverTimestamp();

  await productRef.update(safeUpdates);
  return { productID, updated: true };
});

module.exports = { createProduct, updateProduct };
