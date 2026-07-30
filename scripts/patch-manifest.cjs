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

if (json.options_ui) {
  json.options_ui.open_in_tab = true;
}

fs.writeFileSync(manifestPath, JSON.stringify(json, null, 2), 'utf8');
console.log(`Patched ${manifestPath}: options_ui.open_in_tab = true`);
