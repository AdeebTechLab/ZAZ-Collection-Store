const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const PRODUCTS_PATHNAME = 'products-data.json';
const VALID_CATEGORIES = ['women', 'men', 'bag', 'shoes', 'watches'];

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'products-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateProducts(data) {
  if (!Array.isArray(data)) return 'Product data must be an array';
  const seenIds = new Set();
  for (const product of data) {
    if (!product || typeof product !== 'object') return 'Each product must be an object';
    if (typeof product.id !== 'number' || Number.isNaN(product.id)) {
      return 'Every product needs a numeric id';
    }
    if (seenIds.has(product.id)) return `Duplicate product id: ${product.id}`;
    seenIds.add(product.id);

    if (typeof product.name !== 'string' || !product.name.trim()) {
      return `Product ${product.id} needs a non-empty name`;
    }
    if (!VALID_CATEGORIES.includes(product.category)) {
      return `Product "${product.name}" needs a valid category (${VALID_CATEGORIES.join(', ')})`;
    }
    if (typeof product.price !== 'number' || Number.isNaN(product.price) || product.price < 0) {
      return `Product "${product.name}" needs a valid non-negative price`;
    }
    if (product.oldPrice != null) {
      if (typeof product.oldPrice !== 'number' || Number.isNaN(product.oldPrice) || product.oldPrice < 0) {
        return `Product "${product.name}" has an invalid old price for its discount`;
      }
      if (product.oldPrice <= product.price) {
        return `Product "${product.name}"'s old price must be higher than its current price`;
      }
    }
    if (typeof product.stock !== 'number' || Number.isNaN(product.stock) || product.stock < 0) {
      return `Product "${product.name}" needs a valid non-negative stock quantity`;
    }
    if (typeof product.image !== 'string' || !product.image.trim()) {
      return `Product "${product.name}" needs an image`;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Try the live, admin-edited copy in Vercel Blob first. Fall back to the
    // JSON file bundled in the deployment so the site keeps working even
    // before Blob storage has been set up or before any edits have been saved.
    try {
      const { head } = require('@vercel/blob');
      const blob = await head(PRODUCTS_PATHNAME);
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) throw new Error('blob fetch failed');
      const data = await response.json();
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
    } catch {
      try {
        const data = loadBundledDefault();
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(data);
      } catch (err) {
        res.status(500).json({ error: 'Could not load product data: ' + err.message });
      }
    }
    return;
  }

  if (req.method === 'PUT') {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const validationError = validateProducts(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const { put } = require('@vercel/blob');
      await put(PRODUCTS_PATHNAME, JSON.stringify(body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save products. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
