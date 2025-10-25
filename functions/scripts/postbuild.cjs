const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'lib', 'functions', 'src');
const artifacts = [
  {
    from: path.join(srcDir, 'index.js'),
    to: path.join(root, 'lib', 'index.js'),
  },
  {
    from: path.join(srcDir, 'index.js.map'),
    to: path.join(root, 'lib', 'index.js.map'),
  },
  {
    from: path.join(srcDir, 'rejoin.js'),
    to: path.join(root, 'lib', 'rejoin.js'),
  },
  {
    from: path.join(srcDir, 'rejoin.js.map'),
    to: path.join(root, 'lib', 'rejoin.js.map'),
  },
];

for (const { from, to } of artifacts) {
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
