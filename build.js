#!/usr/bin/env node
'use strict';
// Renders this content repo to ./out using the ZeroDocs renderer fetched into ./.zerodocs.
// DOCS_ROOT points the (content-agnostic) renderer at THIS repo, so it uses this repo's
// content/, docs.config.json and static/ rather than anything bundled with the renderer.
const path = require('path');
const { execFileSync } = require('child_process');
process.env.DOCS_ROOT = __dirname;
if (!process.env.DOCS_OUT) process.env.DOCS_OUT = path.join(__dirname, 'out');
require('./build-component-index.js');
// Every build renders its own PDF into static/downloads before the site copies static/, so each
// branch and PR preview serves a PDF of its own pages. It takes about a second.
execFileSync(process.execPath, [path.join(__dirname, 'build-pdf.js')], { stdio: 'inherit' });
require('./.zerodocs/build-static.js');
