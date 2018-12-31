/**
 * Morty CMS REST API
 * A simple Node CMS designed to be consumed by any client.
 */

/**
 * Globals
 */

// Replace default Promise with Bluebird
global.Promise = require('bluebird');

const Hapi = require('hapi');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const AuthenticationService = require.main.require('./services/authentication');
const UserService = require.main.require('./services/user');
const CategoryService = require.main.require('./services/category');
const PostService = require.main.require('./services/post');
const config = require('./config');
const routeBuilder = require('./routes');

// Create server
const server = Hapi.server({
  port: config.port,
  router: {
    isCaseSensitive: false,
    stripTrailingSlash: true,
  },
});

async function startAPI() {
  await server.register((require('hapi-auth-jwt2')));

  server.auth.strategy('jwt', 'jwt', {
    key: config.jwtSecret,
    validate: AuthenticationService.validateToken,
    verifyOptions: { algorithms: [config.jwtAlgorithm] },
  });

  server.auth.default('jwt');

  const routes = await routeBuilder();
  server.route(routes);

  // Initialize tables
  await initializeTables();

  await server.start();
  return server;
}

async function initializeTables() {
  await UserService.init();
  await CategoryService.init();
  await PostService.init();
}

function init() {
  if (cluster.isMaster && config.enableClustering) {
    // Create a worker for each thread
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('online', (worker) => {
      console.log(`Worker ${worker.process.pid} online`);
    });

    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died with code: ${code} and signal: ${signal}`);
      console.log('Creating replacement...');
      cluster.fork();
    });
  } else {
    startAPI().then((server) => {
      console.log(`Server running at: ${server.info.uri}`);
    }).catch((err) => {
      console.log(err);
      process.exit(1);
    });
  }
}

init();
