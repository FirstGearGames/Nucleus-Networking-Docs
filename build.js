#!/usr/bin/env node
'use strict';
// Renders this content repo to ./out using the ZeroDocs renderer fetched into ./.freedoc.
// DOCS_ROOT points the (content-agnostic) renderer at THIS repo, so it uses this repo's
// content/, docs.config.json and static/ rather than anything bundled with the renderer.
const path = require('path');
process.env.DOCS_ROOT = __dirname;
if (!process.env.DOCS_OUT) process.env.DOCS_OUT = path.join(__dirname, 'out');
require('./.freedoc/build-static.js');
