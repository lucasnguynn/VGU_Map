#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const swPath = path.join(root, 'sw.js');
const htmlPath = path.join(root, 'index.html');
const buildVersion = process.env.BUILD_VERSION || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function stampServiceWorker(filePath, version) {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(/const SW_VERSION = '.*?';/, `const SW_VERSION = '${version}';`);
  if (original === updated) throw new Error(`SW_VERSION constant not found in ${filePath}`);
  fs.writeFileSync(filePath, updated, 'utf8');
}

function stampHtmlVersion(filePath, version) {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(/data-app-version=".*?"/, `data-app-version="${version}"`);
  if (original === updated) throw new Error(`data-app-version attribute not found in ${filePath}`);
  fs.writeFileSync(filePath, updated, 'utf8');
}

stampServiceWorker(swPath, buildVersion);
stampHtmlVersion(htmlPath, buildVersion);
console.log(`✅ PWA build version stamped: ${buildVersion}`);
