/**
 * Category Service
 *
 * Manages all actions related to Categories
 */

const database = require.main.require('./services/database');
const config = require.main.require('./config');

/**
 * Prepares the table for use
 * @returns {void}
 */
exports.init = async () => {
  await database.query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name CITEXT NOT NULL,
    description TEXT DEFAULT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE (name)
  )`);

  // Ensure default categories exist
  await Promise.all(config.defaultCategories.map(
    async ({ name, description }, index) => (database.query('INSERT INTO categories(id, name, description) VALUES($1, $2, $3) ON CONFLICT DO NOTHING', [index + 1, name, description])),
  ));

  // Create index for search on category name
  await database.query(`CREATE INDEX IF NOT EXISTS index_categories_full_text ON categories using
  gin((name) gin_trgm_ops);`);

  // TODO: Create index for search on description
};

/**
 * Creates a new category
 * @param {Object} params New category parameters
 * @param {String} params.name New category's name
 * @param {String} params.description (optional) New category's description
 * @returns {Category} Created category
 */
exports.create = async ({
  name,
  description = '',
}) => {
  if (!name) {
    throw new Error('Invalid Create Payload Provided');
  }

  const result = await database.query(
    `INSERT INTO categories(name, description) VALUES($1, $2)
    RETURNING id, name, description`,
    [name, description],
  );

  if (result.rowCount === 0) {
    throw new Error('No Records Updated');
  }

  return result.rows[0];
};

/**
 * Fetches a single category by id
 * @param {Number} id Category's id
 * @param {Object} options Find options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @returns {Category} Found category
 */
exports.findOneById = async (
  id,
  { paranoid = true } = { paranoid: true },
) => {
  // Find the category
  let query = `SELECT id, name, description FROM categories
    WHERE categories.id = $1
  `;

  if (paranoid) {
    query += ' AND "deletedAt" IS NULL';
  }

  const result = await database.query(query, [id]);
  const category = result.rows[0];

  if (!category) {
    // No Category found
    throw new Error('No Record Found');
  }
  return category;
};

/**
 * Fetches categories
 * @param {String} searchText (optional) Text to search against
 * @param {Object} options (optional) Search options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @param {Number} options.limit (optional) Maximum number of records to return, defaults to no limit
 * @param {Number} options.offset (optional) Number of records to skip over, defaults to 0
 * @param {String} options.orderBy (optional) Which column to sort records by, defaults to id
 * @returns {Category} Found category
 */
exports.search = async (
  searchText,
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
  let query = 'SELECT id, name, description FROM categories';

  let countQuery = 'SELECT COUNT(*) FROM categories';

  const values = [];
  const where = [];

  if (searchText) {
    values.push(searchText);
    where.push(`(name) LIKE concat('%',(TEXT($${values.length})),'%')`);
  }

  if (paranoid) {
    where.push('"deletedAt" IS NULL');
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
    categories: results.rows,
    count: countResult.rows[0].count,
  };
};

/**
 * Updates a category with provided values.
 * One of the optional values must be provided.
 * @param {Number} id Category's id
 * @param {Object} params New category parameters
 * @param {String} params.name (optional) Category's new name
 * @param {String} params.description (optional) Category's new description
 * @returns {Boolean} Update successful
 */
exports.update = async (id, payload) => {
  if (!payload) {
    throw new Error('Invalid Update Payload Provided');
  }

  const update = { ...payload };

  let query = 'UPDATE categories SET "updatedAt" = CURRENT_TIMESTAMP';
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
 * Deletes a category by id
 * @param {Number} id Category's id
 * @returns {Boolean} Update successful
 */
exports.softDelete = async (id) => {
  await exports.update(id, { deletedAt: new Date() });

  return true;
};
