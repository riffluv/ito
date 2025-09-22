const path = require('path');
const { register } = require('tsconfig-paths');

register({
  baseUrl: path.resolve(__dirname, 'lib'),
  paths: {
    '@/lib/*': ['lib/*'],
  },
});

module.exports = require('./lib/index.js');
