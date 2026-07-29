# ZAZ Collection Store

A clothing store front-end (product listing, cart, wishlist, checkout pages) with a
password-protected **admin panel** for managing products and categories. Product data,
photos, and category names are stored in **Vercel Blob** storage and served through
small **Vercel serverless functions** in `/api`, so changes made in the admin panel go
live on the site immediately — no rebuild or redeploy needed.

- Storefront pages: `index.html` (Home — includes the Deal Of The Week countdown and
  Flash Sales carousel), `product.html` (Shop), `product-detail.html`,
  `shoping-cart.html` (includes a real coupon-code discount box), etc.
- Admin panel: `admin/index.html` (protected by login at `admin/login.html`) — manage
  products, categories, and discount coupons.
- Backend: `api/login.js`, `api/logout.js`, `api/session.js`, `api/products.js`,
  `api/categories.js`, `api/coupons.js`, `api/upload.js`
- Data fallback (used if Blob hasn't been set up yet): `data/products-data.json`,
  `data/categories-data.json`, `data/coupons-data.json`

---

## 1. Deploying the project on Vercel

1. Push this project to a Git repo (GitHub, GitLab, or Bitbucket)
2. **vercel.com → Add New → Project** → import the repo
3. Leave build settings as default *(static site + serverless functions, no build step)* → **Deploy**

⚠️ The storefront will work right away, but the admin panel needs steps 2 & 3 below first.

---

## 2. Connecting Vercel Blob storage

Without this, the admin panel can't save — the site just falls back to the read-only
defaults in `data/`. Quick steps:

1. **Dashboard → Storage tab → Create Database → Blob**
2. Name it, set access to **Public** ⚠️ *(not Private — can't be changed later)* → **Create**
3. Select this project → **Connect** *(auto-adds `BLOB_READ_WRITE_TOKEN` to all environments)*
4. **Deployments → ⋯ → Redeploy**

Done — the admin panel can now save products/categories to Blob storage.

---

## 3. Setting the remaining environment variables

**Settings → Environment Variables**, add these (check Production/Preview/Development for each):

| Name | Value |
|---|---|
| `ADMIN_USERNAME` | e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password |
| `SESSION_SECRET` | a long random string (see below) |

**Generate `SESSION_SECRET`:**
- Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Git Bash / OpenSSL: `openssl rand -hex 32`
- Or any password generator, 40+ random characters

The map on `contact.html` is a plain Google Maps iframe embed (`google.com/maps?...&output=embed`),
so it needs no API key, no Google Cloud project, and no environment variable — it just works.
To update the pinned location, edit the `q=<lat>,<lng>` value in that iframe's `src` in
`contact.html`.

Then **Deployments → ⋯ → Redeploy** so the functions pick up the new variables.

---

## 4. Verifying it works

1. Visit `https://<your-project>.vercel.app/admin/login.html` and log in
2. Edit a product or category → **Save Changes** / **Save Categories**
3. No error banner = Blob is connected. Error like *"Failed to save... make sure Vercel Blob storage is connected"* → recheck steps 2 & 3, then redeploy
4. Refresh the storefront — changes are live immediately (pages fetch `/api/products` and `/api/categories` on load)

---

## 5. Running locally (optional)

The admin panel and API routes are Vercel Functions, so they need the Vercel CLI to run
locally (opening the HTML files directly with `file://` will only show the storefront
with its static fallback data — the admin panel and live saving won't work).

```bash
npm install -g vercel   # if you don't already have it
vercel link             # connect this folder to your Vercel project
vercel env pull .env.local   # pulls ADMIN_USERNAME/ADMIN_PASSWORD/SESSION_SECRET/BLOB_READ_WRITE_TOKEN locally
vercel dev              # starts a local server with the API routes working
```

Then open the local URL it prints (usually `http://localhost:3000`).
