/**
 * Handles posts API actions
 */

const Joi = require('joi');
const Boom = require('boom');
const _ = require('lodash');

const PostService = require.main.require('./services/post');
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
      'authorFirstName',
      'authorLastName',
      'title',
      'template',
      'category',
      '-id',
      '-authorFirstName',
      '-authorLastName',
      '-title',
      '-template',
      '-category',
    ]).default('id'),
    template: Joi.string().min(1),
    category: Joi.string().min(1),
    published: Joi.boolean().default(true),
    author: Joi.number().integer().min(1),
    // TODO: handle tags
  }),
  create: Joi.object().keys({
    author: Joi.number().integer().min(1),
    title: Joi.string().required(),
    description: Joi.string(),
    content: Joi.string().required(),
    category: Joi.number().integer().min(1).required(),
    slug: Joi.string().required(),
    template: Joi.string(),
    published: Joi.boolean(),
    tags: Joi.array().items(Joi.string()),
  }),
  update: Joi.object().keys({
    author: Joi.number().integer().min(1),
    title: Joi.string(),
    description: Joi.string(),
    content: Joi.string(),
    category: Joi.number().integer().min(1),
    slug: Joi.string(),
    template: Joi.string(),
    published: Joi.boolean(),
    tags: Joi.array().items(Joi.string()),
  }),
};

module.exports = prefix => [
  // Search for posts
  {
    method: 'GET',
    path: `${prefix}`,
    handler: async (request, h) => {
      try {
        let canViewUnpublishedPosts = false;
        if (request.auth && request.auth.credentials && request.auth.credentials.id) {
          const hasAuthorPermissions = await AuthenticationService.hasAuthorPermissions(request.auth.credentials.id);
          canViewUnpublishedPosts = hasAuthorPermissions;
        }

        // Set the limit and skip to values provided
        // Default to all entries skipping 0
        const options = {
          limit: _.isNumber(request.query.limit) ? request.query.limit : null,
          offset: _.isNumber(request.query.skip) ? request.query.skip : 0,
          orderBy: request.query.order_by,
        };

        const searchResult = await PostService.search({
          searchText: request.query.searchText,
          template: request.query.template,
          category: request.query.category,
          published: canViewUnpublishedPosts ? request.query.published : true,
          author: request.query.author,
        }, options);
        // TODO: Handle tags

        const response = h.response(searchResult.posts);
        response.header('X-Total-Count', searchResult.count);
        return response;
      } catch (err) {
        return Boom.internal();
      }
    },
    options: {
      cors: true,
      auth: {
        strategy: 'jwt',
        mode: 'optional',
      },
      validate: {
        query: _schemas.search,
      },
    },
  },
  // Create new post
  {
    method: 'POST',
    path: `${prefix}`,
    handler: async (request) => {
      try {
        const userId = request.auth.credentials.id;

        const payload = {
          author: userId,
          ...request.payload,
        };

        const hasEditorPermissions = await AuthenticationService.hasEditorPermissions(userId);
        if (!hasEditorPermissions) {
          // Default to the active user if user does not have editor permissions
          payload.author = userId;
        }

        // TODO: Handle tags

        const post = await PostService.create(payload);
        return post;
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Slug provided is in use');
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
        { method: MiddlewareService.hasAuthorPermissions },
      ],
    },
  },
  // Get a single post by id
  {
    method: 'GET',
    path: `${prefix}/{id}`,
    handler: async (request) => {
      try {
        let canViewUnpublishedPosts = false;
        if (request.auth && request.auth.credentials && request.auth.credentials.id) {
          const hasAuthorPermissions = await AuthenticationService.hasAuthorPermissions(request.auth.credentials.id);
          canViewUnpublishedPosts = hasAuthorPermissions;
        }

        const post = await PostService.findOneById(request.params.id, {
          published: canViewUnpublishedPosts,
        });

        // TODO: Handle tags

        return post;
      } catch (err) {
        return Boom.notFound('Post not Found');
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
  // Get a single post by id
  {
    method: 'PATCH',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      try {
        const { payload } = request;

        const userId = request.auth.credentials.id;

        const hasEditorPermissions = await AuthenticationService.hasEditorPermissions(userId);
        if (!hasEditorPermissions) {
          // Editor permissions required to change author
          delete payload.author;

          // Ensure that the post belongs to the user
          const post = await PostService.findOneById(request.params.id);
          if (post.author !== userId) {
            // Editor permissions required to update another user's post
            return Boom.notFound('Post not Found');
          }
        }

        // TODO: Handle tags

        await PostService.update(request.params.id, payload);
        return h.response().code(204);
      } catch (err) {
        if (err.code === '23505') {
          return Boom.forbidden('Slug provided is in use');
        }
        return Boom.notFound('Post not Found');
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
  // Delete a single post by id
  {
    method: 'DELETE',
    path: `${prefix}/{id}`,
    handler: async (request, h) => {
      // TODO: Support hard delete
      try {
        await PostService.softDelete(request.params.id);
        return h.response().code(204);
      } catch (err) {
        return Boom.notFound('Post not Found');
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
