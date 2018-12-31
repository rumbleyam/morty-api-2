/**
 * Post Service
 *
 * Manages all actions related to Posts
 */

const database = require.main.require('./services/database');

/**
 * Prepares the table for use
 * @returns {void}
 */
exports.init = async () => {
  await database.query(`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    author INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    category INTEGER REFERENCES categories(id),
    slug CITEXT NOT NULL,
    template TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    published BOOLEAN,
    UNIQUE (slug)
  )`);

  // Create tags table
  await database.query(`CREATE TABLE IF NOT EXISTS tags (
    post INTEGER REFERENCES posts(id),
    name TEXT,
    PRIMARY KEY (post, name)
  )`);

  // TODO: Create index for text search
};

/**
 * Creates a new post
 * @param {Object} params New post parameters
 * @param {Number} params.author New post's author
 * @param {String} params.title New post's title
 * @param {String} params.description (optional) New post's description
 * @param {String} params.content New post's content
 * @param {Number} params.category New post's category
 * @param {String} params.slug New post's slug
 * @param {String} params.template (optional) New post's template
 * @param {Boolean} params.published (optional) Whether new post is published
 * @param {String[]} params.tags (optional) Tags associated with the post
 * @returns {Post} Created post
 */
exports.create = async ({
  author,
  title,
  description = '',
  content,
  category,
  slug,
  template = 'default',
  published = false,
  tags = [],
}) => {
  if (!author || !title || !content || !category || !slug) {
    throw new Error('Invalid Create Payload Provided');
  }

  const result = await database.query(
    `INSERT INTO posts(author, title, description, content, category, slug, template, published) VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, title, description, content, slug, template, published`,
    [author, title, description, content, category, slug, template, published],
  );

  if (result.rowCount === 0) {
    throw new Error('No Records Updated');
  }

  // Create tags
  if (tags) {
    await Promise.all(tags.map(
      async tag => (database.query('INSERT INTO tags(post, name) VALUES($1, $2) ON CONFLICT DO NOTHING', [result.rows[0].id, tag])),
    ));
  }

  return result.rows[0];
};

/**
 * Fetches a single post by id
 * @param {Number} id Post's id
 * @param {Object} options Find options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @returns {Post} Found post
 */
exports.findOneById = async (
  id,
  {
    paranoid = true,
    published = true,
  } = {
    paranoid: true,
    published: true,
  },
) => {
  // Find the post
  let query = `SELECT
    posts.id AS id,
    author,
    "firstName" AS "authorFirstName",
    "lastName" AS "authorLastName",
    title,
    posts.description AS description,
    content,
    slug,
    template,
    published,
    category,
    categories.name AS "categoryName",
    posts."createdAt" AS "createdAt",
    posts."updatedAt" AS "updatedAt"
    FROM posts
    LEFT JOIN categories ON posts.category = categories.id
    LEFT JOIN users ON posts.author = users.id
    WHERE posts.id = $1
  `;

  const values = [id];

  // TODO: Handle tags

  if (paranoid) {
    query += ' AND posts."deletedAt" IS NULL';
  }

  if (published) {
    values.push(published);
    query += ` AND "published" = $${values.length}`;
  }

  const result = await database.query(query, values);
  const post = result.rows[0];

  if (!post) {
    // No Post found
    throw new Error('No Record Found');
  }
  return post;
};

/**
 * Fetches posts
 * @param {Object} parameters (optional) Search parameters
 * @param {String} params.searchText (optional) Text to search for
 * @param {String} params.template (optional) Template to search for
 * @param {Number} params.category (optional) Category to search for
 * @param {Boolean} params.published (optional) Whether results should be published
 * @param {Number} params.author (optional) Author to search for
 * @param {Object} options (optional) Search options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @param {Number} options.limit (optional) Maximum number of records to return, defaults to no limit
 * @param {Number} options.offset (optional) Number of records to skip over, defaults to 0
 * @param {String} options.orderBy (optional) Which column to sort records by, defaults to id
 * @returns {Post} Found post
 */
exports.search = async (
  {
    searchText,
    template,
    category,
    published = true,
    author,
  },
  {
    paranoid = true,
    limit = null,
    offset = 0,
    orderBy = 'id',
  } = {
    paranoid: true,
    limit: null,
    offset: 0,
    orderBy: 'id',
  },
) => {
  let query = `SELECT
    posts.id AS id,
    author,
    "firstName" AS "authorFirstName",
    "lastName" AS "authorLastName",
    title,
    posts.description AS description,
    content,
    slug,
    template,
    published,
    category,
    categories.name AS "categoryName",
    posts."createdAt" AS "createdAt",
    posts."updatedAt" AS "updatedAt"
    FROM posts
    LEFT JOIN categories ON posts.category = categories.id
    LEFT JOIN users ON posts.author = users.id
  `;

  // TODO: Handle tags

  let countQuery = 'SELECT COUNT(*) FROM posts';

  const values = [];
  const where = [];

  if (searchText) {
    // TODO: Handle searchText
  }

  if (paranoid) {
    where.push('posts."deletedAt" IS NULL');
  }

  if (template) {
    values.push(template);
    where.push(`template = $${values.length}`);
  }

  if (category) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }

  if (published) {
    values.push(published);
    where.push(`published = $${values.length}`);
  }

  if (author) {
    values.push(author);
    where.push(`author = $${values.length}`);
  }

  if (where.length) {
    const whereClause = ` WHERE ${where.join(' AND ')}`;
    query += whereClause;
    countQuery += whereClause;
  }

  // Count the total records before limit and offset
  const countResult = await database.query(countQuery, values);

  // This is technically vulnerable to SQL injection,
  // but route validation should prevent any attacks.
  // Unfortunately `pg` does not work with parameters for ORDER BY.
  const descendingSort = orderBy.startsWith('-');
  if (descendingSort) {
    query += ` ORDER BY "${orderBy.substr(1)}" DESC`;
  } else {
    query += ` ORDER BY "${orderBy}"`;
  }
  // TODO: Handle multiple sorts

  if (limit) {
    values.push(limit);
    query += ` LIMIT $${values.length}`;
  }

  if (offset) {
    values.push(offset);
    query += ` OFFSET $${values.length}`;
  }

  const results = await database.query(
    query,
    values,
  );

  return {
    posts: results.rows,
    count: countResult.rows[0].count,
  };
};

/**
 * Updates a post with provided values.
 * One of the optional values must be provided
 * @param {Number} id Post's id
 * @param {Object} payload Update post parameters
 * @param {Number} payload.author (optional) Post's new author
 * @param {String} payload.title (optional) Post's new title
 * @param {String} payload.description (optional) Post's new description
 * @param {String} payload.content (optional) Post's new content
 * @param {Number} payload.category (optional) Post's new category
 * @param {String} payload.slug (optional) Post's new slug
 * @param {String} payload.template (optional) Post's new template
 * @param {Boolean} payload.published (optional) Whether post is published
 * @param {String[]} payload.tags (optional) Tags associated with the post
 * @returns {Post} Created post
 */
exports.update = async (id, payload) => {
  if (!payload) {
    throw new Error('Invalid Update Payload Provided');
  }

  const update = { ...payload };
  // Remove tags from update
  delete update.tags;

  // TODO: Handle tags

  let query = 'UPDATE posts SET "updatedAt" = CURRENT_TIMESTAMP';
  const values = [];
  Object.keys(update).forEach((key, index) => {
    query += `, "${key}" = $${index + 1}`;
    values.push(update[key]);
  });
  values.push(id);
  query += ` WHERE id = $${values.length}`;

  const result = await database.query(query, values);
  if (result.rowCount === 0) {
    throw new Error('No Records Updated');
  }

  return true;
};

/**
 * Deletes a post by id
 * @param {Number} id Post's id
 * @returns {Boolean} Update successful
 */
exports.softDelete = async (id) => {
  await exports.update(id, { deletedAt: new Date() });

  return true;
};
