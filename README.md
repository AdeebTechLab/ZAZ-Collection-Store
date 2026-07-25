# ZAZ Collection Store

A clothing store front-end (product listing, cart, wishlist, checkout pages) with a
password-protected **admin panel** for managing products and categories. Product data,
photos, and category names are stored in **Vercel Blob** storage and served through
small **Vercel serverless functions** in `/api`, so changes made in the admin panel go
live on the site immediately — no rebuild or redeploy needed.

- Storefront pages: `index.html` (Home — includes the Deal Of The Week countdown and
  Flash Sales carousel), `product.html` (Shop), `product-detail.html`,
  `shoping-cart.html`, etc.
- Admin panel: `admin/index.html` (protected by login at `admin/login.html`)
- Backend: `api/login.js`, `api/logout.js`, `api/session.js`, `api/products.js`,
  `api/categories.js`, `api/upload.js`
- Data fallback (used if Blob hasn't been set up yet): `data/products-data.json`,
  `data/categories-data.json`

---

## 1. Deploying the project on Vercel

1. Push this project to a Git repository (GitHub, GitLab, or Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import that repository.
3. Leave the build settings as default (no framework/build step is required — it's static
   HTML/CSS/JS plus serverless functions). Click **Deploy**.
4. The first deploy will work for browsing the storefront, but the admin panel **will not
   work yet** until you complete steps 2 and 3 below (connect Blob storage and set the
   environment variables).

---

## 2. Connecting Vercel Blob storage

The admin panel needs a Blob store to save product/category edits to (without it, the
site just falls back to the read-only defaults in `data/`).

1. Open your project in the [Vercel dashboard](https://vercel.com/dashboard).
2. Go to the **Storage** tab (top navigation of the project page).
3. Click **Create Database** → choose **Blob**.
4. Give it a name (e.g. `zaz-collection-store-blob`), then choose the **access mode**:
   select **Public** (not Private). Product photos uploaded from the admin panel are
   stored with public access so they can be shown directly on the storefront (see
   `api/upload.js`), and **the access mode can't be changed later** — if you pick
   Private here you'll need to delete and recreate the store. Click **Create**.
5. On the next screen, Vercel will ask which project(s) to connect it to — select this
   project and click **Connect**.
6. This automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable to your
   project for all environments (Production, Preview, Development) — you don't need to
   create this one by hand.
7. Go to **Deployments** and **redeploy** the latest deployment (⋯ menu → **Redeploy**)
   so the new environment variable is picked up by your functions.

That's it — `api/products.js` and `api/categories.js` will now read/write a
`products-data.json` and `categories-data.json` file inside that Blob store whenever
you click **Save Changes** / **Save Categories** in the admin panel.

---

## 3. Setting the remaining environment variables

Besides the automatic `BLOB_READ_WRITE_TOKEN` from step 2, the admin panel needs three
more environment variables that you set yourself, since they control who's allowed to
log in and how sessions are secured.

1. In the Vercel dashboard, open your project → **Settings → Environment Variables**.
2. Add the following (click **Add** after typing each one):

   | Name | Value | Notes |
   |---|---|---|
   | `ADMIN_USERNAME` | e.g. `admin` | Username required to log into `/admin` |
   | `ADMIN_PASSWORD` | a strong password | Password required to log into `/admin` |
   | `SESSION_SECRET` | a long random string | Signs the login session cookie — see below for how to generate one |

   For each variable, tick **Production**, **Preview**, and **Development** (unless you
   intentionally want different admin credentials per environment).

3. **Generating a `SESSION_SECRET`:** it just needs to be a long, random, unguessable
   string — it's never shown to users. Generate one with any of these:
   - In a terminal with Node.js installed: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - In **Git Bash** (Windows) — it ships with OpenSSL, so Node isn't required:
     `openssl rand -hex 32`
   - Or any password generator set to 40+ random characters.

4. After adding all three variables, go to **Deployments** and **redeploy** (⋯ menu →
   **Redeploy**) so the functions pick them up. (Vercel does not apply new/changed
   environment variables to a deployment retroactively — a redeploy is required.)

---

## 4. Verifying it works

1. Visit `https://<your-project>.vercel.app/admin/login.html`.
2. Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set.
3. Edit a product (price, stock, discount, photo, etc.) or click **✏️ Edit Categories**
   to rename a category, then click **Save Changes** / **Save Categories**.
4. If it saves without an error banner, Blob storage is connected correctly. If you see
   an error like *"Failed to save products/categories… make sure Vercel Blob storage is
   connected"*, double check steps 2 and 3 above, then redeploy.
5. Refresh the storefront (`index.html`, `product.html`) — your changes
   should already be live, since those pages fetch live data from `/api/products` and
   `/api/categories` on every load.

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
