// Serves the Google Maps JavaScript API key from an environment variable so
// it never has to be committed to the repo in plain text. The key still ends
// up visible in the browser once the map loads (that's unavoidable for any
// client-side Maps JS embed) — the point of this endpoint isn't to hide the
// key from users, it's to:
//   1. Keep it out of git history / public source, so it can be rotated
//      without a code change.
//   2. Let the map degrade gracefully (contact.html just skips it) on any
//      deployment where GOOGLE_MAPS_API_KEY hasn't been set yet, instead of
//      shipping a stale/broken key.
//
// Regardless, once GOOGLE_MAPS_API_KEY is set, restrict it in the Google
// Cloud Console to your site's domain(s) and to the "Maps JavaScript API"
// only, so it can't be reused elsewhere if someone copies it from network
// traffic.
module.exports = async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || null;
  // Not sensitive to cache — same value for everyone, changes only on redeploy.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ key });
};
