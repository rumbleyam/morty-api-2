/**
 * Handles top level API actions
 */

const Joi = require('joi');
const Boom = require('boom');

const UserService = require.main.require('./services/user');

/**
 * @object
 * Route Validation Schemas
 */
const _schemas = {
  register: Joi.object().keys({
    email: Joi.string().email().required(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    password: Joi.string().min(8).required(),
  }),
  login: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required(),
  }),
  changePassword: Joi.object().keys({
    password: Joi.string().min(1).required(),
    newPassword: Joi.string().min(1).required(),
  }),
  changeEmail: Joi.object().keys({
    password: Joi.string().min(1).required(),
    email: Joi.string().min(1).required(),
  }),
};

module.exports = prefix => [
  {
    method: 'GET',
    path: `${prefix}/`,
    handler: () => 'Morty REST API 2',
    options: {
      cors: true,
      auth: false,
    },
  },
  // Register an Account
  {
    method: 'POST',
    path: `${prefix}/register`,
    handler: async (request) => {
      try {
        await UserService.register(request.payload);
        return {
          message: 'User created',
        };
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Email provided is in use');
        }
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      auth: false,
      validate: {
        payload: _schemas.register,
      },
    },
  },
  // Login to an Account
  {
    method: 'POST',
    path: `${prefix}/login`,
    handler: async (request) => {
      try {
        const token = await UserService.login(request.payload);
        return { token };
      } catch (err) {
        if (err.message === 'Invalid Credentials') {
          return Boom.unauthorized('Invalid Credentials');
        }
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      auth: false,
      validate: {
        payload: _schemas.login,
      },
    },
  },
  // Lookup the current user
  {
    method: 'GET',
    path: `${prefix}/whoami`,
    handler: async (request) => {
      try {
        const user = await UserService.getOneById(request.auth.credentials.id);
        return user;
      } catch (err) {
        // If token is valid, user should exist
        return Boom.internal();
      }
    },
    options: {
      cors: true,
    },
  },
  // Change the current user's password
  {
    method: 'POST',
    path: `${prefix}/change_password`,
    handler: async (request, h) => {
      try {
        const { password, newPassword } = request.payload;
        await UserService.changePassword(request.auth.credentials.id, password, newPassword);
        return h.response().code(204);
      } catch (err) {
        if (err.message === 'Invalid Password') {
          return Boom.unauthorized('Invalid Password');
        }
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      validate: {
        payload: _schemas.changePassword,
      },
    },
  },
  // Change the current user's email
  {
    method: 'POST',
    path: `${prefix}/change_email`,
    handler: async (request, h) => {
      try {
        const { password, email } = request.payload;
        await UserService.changeEmail(request.auth.credentials.id, password, email);
        return h.response().code(204);
      } catch (err) {
        if (err.message === 'Invalid Password') {
          return Boom.unauthorized('Invalid Password');
        }
        if (err.code === '23505') {
          return Boom.forbidden('Email provided is in use');
        }
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      validate: {
        payload: _schemas.changeEmail,
      },
    },
  },
];
