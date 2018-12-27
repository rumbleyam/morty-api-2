/**
 * Middle Service
 *
 * Provides helper methods to be applied as hooks for requests
 */

const Boom = require('boom');

const AuthenticationService = require.main.require('./services/authentication');

/**
 * Determines if a user has admin permissions
 * @param {Object} request Request object, to check user id
 * @returns {Boolean|Boom} True if the user has admin permissions, Boom otherwise
 */
exports.hasAdminPermissions = async (request) => {
  const hasPermission = await AuthenticationService.hasAdminPermissions(request.auth.credentials.id);
  if (!hasPermission) {
    return Boom.unauthorized('Admin access required to access this content.');
  }

  return true;
};

/**
 * Determines if a user has editor permissions
 * @param {Object} request Request object, to check user id
 * @returns {Boolean|Boom} True if the user has editor permissions, Boom otherwise
 */
exports.hasEditorPermissions = async (request) => {
  const hasPermission = await AuthenticationService.hasEditorPermissions(request.auth.credentials.id);
  if (!hasPermission) {
    return Boom.unauthorized('Editor access required to access this content.');
  }

  return true;
};

/**
 * Determines if a user has author permissions
 * @param {Object} request Request object, to check user id
 * @returns {Boolean|Boom} True if the user has author permissions, Boom otherwise
 */
exports.hasAuthorPermissions = async (request) => {
  const hasPermission = await AuthenticationService.hasAuthorPermissions(request.auth.credentials.id);
  if (!hasPermission) {
    return Boom.unauthorized('Author access required to access this content.');
  }

  return true;
};
