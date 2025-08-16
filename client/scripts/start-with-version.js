#!/usr/bin/env node
// Cross-platform launcher to set REACT_APP_VERSION and start CRA
process.env.REACT_APP_VERSION = require('../package.json').version || '';
// Delegate to react-scripts start
require('react-scripts/scripts/start');
