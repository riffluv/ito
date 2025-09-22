const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'lib', 'functions', 'src');
const destFile = path.join(root, 'lib', 'index.js');
const destMap = path.join(root, 'lib', 'index.js.map');
const fromFile = path.join(srcDir, 'index.js');
const fromMap = path.join(srcDir, 'index.js.map');

if (fs.existsSync(fromFile)) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.copyFileSync(fromFile, destFile);
}
if (fs.existsSync(fromMap)) {
  fs.copyFileSync(fromMap, destMap);
}
