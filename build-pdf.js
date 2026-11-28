#!/usr/bin/env node
'use strict';
// Regenerates static/downloads/*.pdf using the ZeroDocs renderer fetched into ./.zerodocs.
// Mirrors build.js's DOCS_ROOT wiring, but for the PDF export instead of the static HTML
// site. build.js runs it first on every build, so the PDFs are build output and not tracked.
const path = require('path');
process.env.DOCS_ROOT = __dirname;
require('./.zerodocs/build-pdf.js');
