const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node patch-manifest.js <target-dir>');
  process.exit(1);
}

const manifestPath = path.resolve('.output', target, 'manifest.json');
const raw = fs.readFileSync(manifestPath, 'utf8');
const json = JSON.parse(raw);

// WXT auto-generates options_ui when an entrypoints/options/ folder exists.
// For a full-tab preferences page, we must use options_page instead.
// Remove options_ui and ensure options_page points to the correct HTML.
if (json.options_ui) {
  delete json.options_ui;
}

if (!json.options_page) {
  json.options_page = 'options.html';
}

fs.writeFileSync(manifestPath, JSON.stringify(json, null, 2), 'utf8');
console.log(`Patched ${manifestPath}: removed options_ui, set options_page`);
