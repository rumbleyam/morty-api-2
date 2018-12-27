/**
 * Authentication Service
 *
 * Handles generating passwords, verifying credentials, and generating tokens
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserService = require.main.require('./services/user');
const config = require.main.require('./config');

/**
 * Hashes a password using bcrypt
 * @param {String} password Password to hash
 * @returns {String} Password hash
 */
exports.createHash = password => bcrypt.hash(password, config.bcryptSaltRounds);

/**
 * Verifies a bcrypt hash matches a plaintext password
 * @param {String} password Plaintext password to verify
 * @param {String} hash Hash to compare against
 * @returns {Boolean} Whether hashes matched
 */
exports.verifyCredentials = (password, hash) => bcrypt.compare(password, hash);

/**
 * Creates a token from a provided payload
 * @param {Object} payload Payload to include in signed token
 * @returns {String} Auth token (JWT)
 */
exports.createToken = payload => new Promise((resolve, reject) => {
  jwt.sign(payload, config.jwtSecret, {
    algorithm: config.jwtAlgorithm,
    expiresIn: config.jwtExpiry,
  }, (err, token) => {
    if (err) {
      return reject(err);
    }
    return resolve(token);
  });
});

/**
 * Validates a signed JWT
 * Auth token can technically be valid, but be blacklisted by the system
 * @param {Object} decoded The decoded payload
 * @returns {Object} Objecting containing an `isValid` flag, indicating whether the token is good
 */
exports.validateToken = async (decoded) => {
  const createTime = new Date(decoded.iat * 1000);
  try {
    await UserService.verifyToken({ id: decoded.id, createTime });
    return { isValid: true };
  } catch (err) {
    return { isValid: false };
  }
};

/**
 * Determines if a user has admin permissions
 * @param {Number} id Id of user to look up
 * @returns {Boolean} If the user has admin permissions
 */
exports.hasAdminPermissions = async (id) => {
  const user = await UserService.findOneById(id);
  return user.role === 'Admin';
};

/**
 * Determines if a user has editor permissions
 * @param {Number} id Id of user to look up
 * @returns {Boolean} If the user has editor permissions
 */
exports.hasEditorPermissions = async (id) => {
  const user = await UserService.findOneById(id);
  return user.role === 'Editor' || user.role === 'Admin';
};

/**
 * Determines if a user has author permissions
 * @param {Number} id Id of user to look up
 * @returns {Boolean} If the user has author permissions
 */
exports.hasAuthorPermissions = async (id) => {
  const user = await UserService.findOneById(id);
  return user.role === 'Author' || user.role === 'Editor' || user.role === 'Admin';
};
