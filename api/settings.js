const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const SETTINGS_PATHNAME = 'settings-data.json';

// Store-wide settings the admin can change without touching code. Currently
// just the flat delivery charge (in the same currency/units as product
// prices) that's added on top of the cart subtotal at checkout — more
// settings can be added to this same object later without a new endpoint.

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'settings-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateSettings(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Settings data must be an object';
  }
  if (
    typeof data.deliveryCharge !== 'number' ||
    Number.isNaN(data.deliveryCharge) ||
    !Number.isFinite(data.deliveryCharge) ||
    data.deliveryCharge < 0
  ) {
    return 'Delivery charge must be a non-negative number';
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Try the live, admin-edited copy in Vercel Blob first. Fall back to the
    // JSON file bundled in the deployment so the site keeps working even
    // before Blob storage has been set up or before an admin has saved
    // anything yet (delivery charge defaults to 0 / free in that case).
    try {
      const { head } = require('@vercel/blob');
      const blob = await head(SETTINGS_PATHNAME);
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
        res.status(500).json({ error: 'Could not load settings: ' + err.message });
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

    const validationError = validateSettings(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Only persist known fields, so an unexpected extra key in the request
    // body can't sneak into stored settings.
    const clean = { deliveryCharge: body.deliveryCharge };

    try {
      const { put } = require('@vercel/blob');
      await put(SETTINGS_PATHNAME, JSON.stringify(clean, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save settings. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
