#!/usr/bin/env node
/*
  Design audit script
  - Scans source (components/, app/, lib/) for inline color/gradient values and raw Chakra Buttons.
  - Prints warnings; exit code 0 (advisory) to avoid blocking local work.
*/
const fs = require('fs');
const path = require('path');

const ROOTS = ['components', 'app', 'lib'];
const FILE_RE = /\.(tsx?|jsx?)$/i;
const COLOR_PAT = /(rgba\(|hsla?\(|#[0-9a-fA-F]{3,8}\b|linear\()/;
const RAW_BTN_IMPORT = /from\s+["']@chakra-ui\/react["'].*\{[^}]*\bIcon?Button\b[^}]*\}/;
const RAW_BTN_TAG = /<Icon?Button\b/;

function* walk(dir) {
  const ents = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'docs') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (FILE_RE.test(e.name)) yield p;
  }
}

let warnings = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split(/\r?\n/);
    // color / gradient literals
    lines.forEach((ln, i) => {
      // ignore object gradient syntax using tokens, e.g. linear(to-b, canvasBg, panelSubBg)
      if (/linear\(to-/.test(ln)) return;
      if (COLOR_PAT.test(ln)) {
        warnings.push(`${file}:${i + 1}: avoid raw color/gradient, use tokens`);
      }
    });
    // raw Chakra Button usage
    if (RAW_BTN_IMPORT.test(src) && RAW_BTN_TAG.test(src)) {
      warnings.push(`${file}: raw Chakra Button detected — prefer AppButton/AppIconButton`);
    }
  }
}

if (warnings.length) {
  console.log('\nDesign audit warnings (advisory):');
  console.log(warnings.map(w => ` - ${w}`).join('\n'));
  console.log('\nTip: replace with semantic tokens or recipes.');
} else {
  console.log('Design audit: no issues found.');
}
process.exit(0);
