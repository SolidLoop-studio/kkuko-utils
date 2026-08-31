// scripts/release.js
// Minimal CommonJS loader that dynamically imports the ESM implementation.
(async function () {
  try {
    await import('./release.mjs');
  } catch (e) {
    console.error('Failed to load ESM release module:', e);
    process.exit(1);
  }
})();