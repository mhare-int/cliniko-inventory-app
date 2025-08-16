#!/usr/bin/env node
// Cross-platform launcher to set REACT_APP_VERSION and run CRA build
process.env.REACT_APP_VERSION = require('../package.json').version || '';
require('react-scripts/scripts/build');
