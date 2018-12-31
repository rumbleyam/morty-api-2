/**
 * Handles user API actions
 */

const Joi = require('joi');
const Boom = require('boom');
const _ = require('lodash');

const UserService = require.main.require('./services/user');
const MiddlewareService = require.main.require('./services/middleware');
const AuthenticationService = require.main.require('./services/authentication');

/**
 * @object
 * Route Validation Schemas
 */
const _schemas = {
  findOneById: {
    id: Joi.number().integer().min(1).required(),
  },
  search: Joi.object().keys({
    searchText: Joi.string().min(1),
    limit: Joi.number().integer().min(0),
    skip: Joi.number().integer().min(0),
    page: Joi.number().integer().min(1),
    per_page: Joi.number().integer().min(1),
    order_by: Joi.string().valid([
      'id',
      'firstName',
      'lastName',
      'email',
      'role',
      '-id',
      '-firstName',
      '-lastName',
      '-email',
      '-role',
    ]).default('id'),
  }),
  create: Joi.object().keys({
    email: Joi.string().email().required(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    password: Joi.string().min(8).required(),
    role: Joi.number().integer().min(1),
  }),
  update: Joi.object().keys({
    email: Joi.string().email(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    password: Joi.string().min(8),
    role: Joi.number().integer().min(1),
  }),
};

module.exports = prefix => [
  // Search for users
  {
    method: 'GET',
    path: `${prefix}`,
    handler: async (request, h) => {
      try {
        // Set the limit and skip to values provided
        // Default to all entries skipping 0
        const options = {
          limit: _.isNumber(request.query.limit) ? request.query.limit : null,
          offset: _.isNumber(request.query.skip) ? request.query.skip : 0,
          orderBy: request.query.order_by,
        };

        const searchResult = await UserService.search(request.query.searchText, options);
        const response = h.response(searchResult.users);
        response.header('X-Total-Count', searchResult.count);
        return response;
      } catch (err) {
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      auth: false,
      validate: {
        query: _schemas.search,
      },
    },
  },
  // Create new user
  {
    method: 'POST',
    path: `${prefix}`,
    handler: async (request) => {
      try {
        const user = await UserService.create(request.payload);
        return user;
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Email provided is in use');
        }
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      validate: {
        payload: _schemas.create,
      },
      pre: [
        { method: MiddlewareService.hasAdminPermissions },
      ],
    },
  },
  // Get a single user by id
  {
    method: 'GET',
    path: `${prefix}/{id}`,
    handler: async (request) => {
      try {
        const user = await UserService.findOneById(request.params.id);
        return user;
      } catch (err) {
        return Boom.notFound('User not Found');
      }
    },
    options: {
      cors: true,
      auth: false,
      validate: {
        params: _schemas.findOneById,
      },
    },
  },
  // Get a single user by id
  {
    method: 'PATCH',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      try {
        const { payload } = request;
        const userId = request.auth.credentials.id;
        const hasAdminPermissions = await AuthenticationService.hasAdminPermissions(userId);
        if (!hasAdminPermissions && request.params.id !== userId) {
          // Non admins can only update their own user
          return Boom.forbidden('Only admins can update users other than themselves');
        }

        if (!hasAdminPermissions) {
          // Non admins cannot update roles, emails, or passwords through this endpoint
          delete payload.role;
          delete payload.email;
          delete payload.password;
        }

        await UserService.update(request.params.id, payload);
        return h.response().code(204);
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Email provided is in use');
        }
        return Boom.notFound('User not Found');
      }
    },
    options: {
      cors: true,
      validate: {
        params: _schemas.findOneById,
        payload: _schemas.update,
      },
    },
  },
  // Delete a single user by id
  {
    method: 'DELETE',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      // TODO: Support hard delete
      try {
        await UserService.softDelete(request.params.id);
        return h.response().code(204);
      } catch (err) {
        return Boom.notFound('User not Found');
      }
    },
    options: {
      cors: true,
      validate: {
        params: _schemas.findOneById,
      },
      pre: [
        { method: MiddlewareService.hasAdminPermissions },
      ],
    },
  },
];
