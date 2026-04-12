const Module = require('module');
const path = require('path');
const fs = require('fs');

const srcDir = path.join(__dirname, '..', 'src');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    const base = path.join(srcDir, rel);
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx', '.js']) {
      const full = base + ext;
      if (fs.existsSync(full)) {
        return originalResolve.call(this, full, parent, isMain, options);
      }
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
