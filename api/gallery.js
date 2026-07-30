const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const GALLERY_PATHNAME = 'gallery-data.json';

// This is the standalone site-wide photo gallery (lookbook style — shown on
// gallery.html), separate from the per-product photo galleries managed in
// api/products.js. Each entry is just a photo + optional caption; order in
// the array is display order.
const MAX_GALLERY_ITEMS = 60;

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'gallery-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateGallery(data) {
  if (!Array.isArray(data)) return 'Gallery data must be an array';
  if (data.length > MAX_GALLERY_ITEMS) {
    return `Gallery can have at most ${MAX_GALLERY_ITEMS} photos`;
  }
  const seenIds = new Set();
  for (const item of data) {
    if (!item || typeof item !== 'object') return 'Each gallery item must be an object';
    if (typeof item.id !== 'number' || Number.isNaN(item.id)) {
      return 'Every gallery photo needs a numeric id';
    }
    if (seenIds.has(item.id)) return `Duplicate gallery photo id: ${item.id}`;
    seenIds.add(item.id);

    if (typeof item.image !== 'string' || !item.image.trim()) {
      return `Gallery photo ${item.id} needs an image`;
    }
    if (item.caption != null && typeof item.caption !== 'string') {
      return `Gallery photo ${item.id} has an invalid caption`;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Try the live, admin-edited copy in Vercel Blob first. Fall back to the
    // JSON file bundled in the deployment so the site keeps working even
    // before Blob storage has been set up or before any photos have been
    // saved yet.
    try {
      const { head } = require('@vercel/blob');
      const blob = await head(GALLERY_PATHNAME);
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
        res.status(500).json({ error: 'Could not load gallery data: ' + err.message });
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

    const validationError = validateGallery(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const { put } = require('@vercel/blob');
      await put(GALLERY_PATHNAME, JSON.stringify(body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save gallery. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
