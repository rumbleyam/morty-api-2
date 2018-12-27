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
const config = require('./config');
const routeBuilder = require('./routes');

// Create server
const server = Hapi.server({
  port: config.port,
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

  await server.start();
  return server;
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
