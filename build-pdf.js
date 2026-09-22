#!/usr/bin/env node
'use strict';
// Regenerates static/downloads/*.pdf using the ZeroDocs renderer fetched into ./.zerodocs.
// Mirrors build.js's DOCS_ROOT wiring, but for the PDF export instead of the static HTML
// site. Not run on every build.js (Cloudflare's per-PR/production command): see
// .github/workflows/build-pdf.yml for when this actually runs.
const path = require('path');
process.env.DOCS_ROOT = __dirname;
require('./.zerodocs/build-pdf.js');
