/**
 * Handles category API actions
 */

const Joi = require('joi');
const Boom = require('boom');
const _ = require('lodash');

const CategoryService = require.main.require('./services/category');
const MiddlewareService = require.main.require('./services/middleware');

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
      'name',
      'description',
      '-id',
      '-name',
      '-description',
    ]).default('id'),
  }),
  create: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string(),
  }),
  update: Joi.object().keys({
    name: Joi.string(),
    description: Joi.string(),
  }),
};

module.exports = prefix => [
  // Search for categories
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

        const searchResult = await CategoryService.search(request.query.searchText, options);
        const response = h.response(searchResult.categories);
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
  // Create new category
  {
    method: 'POST',
    path: `${prefix}`,
    handler: async (request) => {
      try {
        const category = await CategoryService.create(request.payload);
        return category;
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Name provided is in use');
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
  // Get a single category by id
  {
    method: 'GET',
    path: `${prefix}/{id}`,
    handler: async (request) => {
      try {
        const category = await CategoryService.findOneById(request.params.id);
        return category;
      } catch (err) {
        return Boom.notFound('Category not Found');
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
  // Get a single category by id
  {
    method: 'PATCH',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      try {
        const { payload } = request;

        await CategoryService.update(request.params.id, payload);
        return h.response().code(204);
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Name provided is in use');
        }
        return Boom.notFound('Category not Found');
      }
    },
    options: {
      cors: true,
      validate: {
        params: _schemas.findOneById,
        payload: _schemas.update,
      },
      pre: [
        { method: MiddlewareService.hasAdminPermissions },
      ],
    },
  },
  // Delete a single category by id
  {
    method: 'DELETE',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      // TODO: Support hard delete
      try {
        await CategoryService.softDelete(request.params.id);
        return h.response().code(204);
      } catch (err) {
        return Boom.notFound('Category not Found');
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
