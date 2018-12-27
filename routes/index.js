/**
 * Route Loader
 *
 * Dynamically loads each route in the routes directory
 */

const fs = require('fs').promises;

module.exports = async () => {
  const files = await fs.readdir('./routes');
  let routes = [];

  files.forEach((file) => {
    if (file.endsWith('.js') && file !== 'index.js') {
      // Use the file name for the route unless it's root
      const prefix = file === 'root.js' ? '' : `/${file.split('.js')[0]}`;
      routes = [...routes, ...require.main.require(`./routes/${file}`)(prefix)];
    }
  });

  return routes;
};
