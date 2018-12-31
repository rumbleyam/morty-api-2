/**
 * User Service
 *
 * Manages all actions related to Users
 */

const database = require.main.require('./services/database');
const AuthenticationService = require.main.require('./services/authentication');
const config = require.main.require('./config');

/**
 * Prepares the table for use
 * @returns {void}
 */
exports.init = async () => {
  // Create roles table first
  await database.query(`CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    name TEXT,
    UNIQUE (name)
  )`);

  // Ensure default roles exist
  await Promise.all(config.defaultRoles.map(
    async (role, index) => (database.query('INSERT INTO user_roles(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING', [index + 1, role])),
  ));

  await database.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role INTEGER REFERENCES user_roles(id) DEFAULT 4,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    "tokenBlacklistDate" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE (email)
  )`);

  // Create index for text search
  await database.query(`CREATE INDEX IF NOT EXISTS index_users_full_text ON users using
    gin(("firstName" || ' ' || "lastName" || ' ' || email) gin_trgm_ops);`);
};

/**
 * Creates a new user
 * @param {Object} params New user parameters
 * @param {String} params.email New user's email
 * @param {String} params.password New user's password
 * @param {String} params.firstName (optional) New user's first name
 * @param {String} params.lastName (optional) New user's last name
 * @param {Number} params.role (optional) New user's role
 * @returns {User} Created user (without role)
 */
exports.create = async ({
  email,
  firstName = '',
  lastName = '',
  password,
  role = 4,
}) => {
  if (!email || !password) {
    throw new Error('Invalid Create Payload Provided');
  }

  const hash = await AuthenticationService.createHash(password);

  const result = await database.query(
    `INSERT INTO users("firstName", "lastName", email, password, role) VALUES($1, $2, $3, $4, $5)
    RETURNING id, "firstName", "lastName", email, "createdAt", "updatedAt", "deletedAt"`,
    [firstName, lastName, email.toLowerCase(), hash, role],
  );

  if (result.rowCount === 0) {
    throw new Error('No Records Updated');
  }

  return result.rows[0];
};

/**
 * Registers an account and logs the user in
 * @param {Object} params New user parameters
 * @param {String} params.email New user's email
 * @param {String} params.password New user's password
 * @param {String} params.firstName (optional) New user's first name
 * @param {String} params.lastName (optional) New user's last name
 * @returns {String} Auth token
 */
exports.register = async ({
  email,
  firstName = '',
  lastName = '',
  password,
}) => {
  await exports.create({
    email,
    firstName,
    lastName,
    password,
    role: 4,
  });

  // Registration successful, log the user in
  const token = await exports.login({ email, password });
  return token;
};

/**
 * Verifies credentials, returns an auth token
 * @param {Object} params Login parameters
 * @param {String} params.email User's email
 * @param {String} params.password User's password
 * @returns {String} Auth token
 */
exports.login = async ({ email, password }) => {
  // Find the user
  const result = await database.query('SELECT id, password FROM users WHERE "deletedAt" IS NULL AND email = $1', [email.toLowerCase()]);
  const user = result.rows[0];

  if (!user) {
    // No user found
    throw new Error('Invalid Credentials');
  }

  // User found, verify password
  const passwordMatches = await AuthenticationService.verifyCredentials(password, user.password);
  if (!passwordMatches) {
    // Password does not match
    throw new Error('Invalid Credentials');
  }

  // Password verified, create token
  const { id } = user;
  const token = await AuthenticationService.createToken({ id });
  return token;
};

/**
 * Verifies that a valid token has not been invalidated
 * Token is valid if it was created after user's "tokenBlacklistDate" if present
 * @param {Object} params Verify Token parameters
 * @param {Number} params.id User's id
 * @param {Date} params.createTime When user's token was created
 * @returns {Boolean} Whether token is valid
 */
exports.verifyToken = async ({ id, createTime }) => {
  // Find the user
  const result = await database.query(
    'SELECT id FROM users WHERE id = $1 AND "deletedAt" IS NULL AND ("tokenBlacklistDate" IS NULL OR "tokenBlacklistDate" < $2)',
    [id, createTime],
  );
  const user = result.rows[0];

  if (!user) {
    // No user found
    throw new Error('Invalid Token');
  }
  return true;
};

/**
 * Fetches a single user by id
 * @param {Number} id User's id
 * @param {Object} options (optional) Search options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @returns {User} Found user
 */
exports.findOneById = async (
  id,
  { paranoid = true } = { paranoid: true },
) => {
  // Find the user
  let query = `SELECT users.id AS id, "firstName", "lastName", email, "createdAt", "updatedAt", "deletedAt", user_roles.name AS role FROM users
    LEFT JOIN user_roles ON users.role = user_roles.id
    WHERE users.id = $1
  `;

  if (paranoid) {
    query += ' AND "deletedAt" IS NULL';
  }

  const result = await database.query(query, [id]);
  const user = result.rows[0];

  if (!user) {
    // No user found
    throw new Error('No Record Found');
  }
  return user;
};

/**
 * Fetches users
 * @param {String} searchText (optional) Text to search against
 * @param {Object} options (optional) Search options
 * @param {Boolean} options.paranoid (optional) Whether to omit deleted records, defaults to true
 * @param {Number} options.limit (optional) Maximum number of records to return, defaults to no limit
 * @param {Number} options.offset (optional) Number of records to skip over, defaults to 0
 * @param {String} options.orderBy (optional) Which column to sort records by, defaults to id
 * @returns {User} Found user
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
  let query = `SELECT users.id AS id, "firstName", "lastName", email, "createdAt", "updatedAt", "deletedAt", user_roles.name AS role FROM users
  LEFT JOIN user_roles ON users.role = user_roles.id`;

  let countQuery = 'SELECT COUNT(*) FROM users';

  const values = [];
  const where = [];

  if (searchText) {
    values.push(searchText);
    where.push(`("firstName" || "lastName" || email) LIKE concat('%',(TEXT($${values.length})),'%')`);
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
    users: results.rows,
    count: countResult.rows[0].count,
  };
};

/**
 * Updates a user with provided values.
 * One of the optional values must be provided.
 * @param {Number} id User's id
 * @param {Object} payload Update parameters
 * @param {Number} payload.id (optional) User's new id
 * @param {String} payload.email (optional) User's new email
 * @param {String} payload.password (optional) User's new password
 * @param {String} payload.firstName (optional) User's new first name
 * @param {String} payload.lastName (optional) User's new last name
 * @param {Number} payload.role (optional) User's new role
 * @returns {Boolean} Update successful
 */
exports.update = async (id, payload) => {
  if (!payload) {
    throw new Error('Invalid Update Payload Provided');
  }

  const update = { ...payload };

  // Hash password if needed
  if (update.password) {
    update.password = await AuthenticationService.createHash(update.password);
  }

  // Convert email to lowercase if needed
  if (update.email) {
    update.email = update.email.toLowerCase();
  }

  let query = 'UPDATE users SET "updatedAt" = CURRENT_TIMESTAMP';
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
 * Changes a user's password
 * Checks that the old password was provided
 * @param {Number} id User's id
 * @param {String} oldPassword User's password
 * @param {String} newPassword Password to change to
 * @returns {Boolean} Update successful
 */
exports.changePassword = async (id, oldPassword, newPassword) => {
  // Make sure old password matches current password
  // Find the user
  const result = await database.query('SELECT id, password FROM users WHERE "deletedAt" IS NULL AND id = $1', [id]);
  const user = result.rows[0];

  if (!user) {
    // No user found
    throw new Error('Invalid User');
  }

  // User found, verify password
  const passwordMatches = await AuthenticationService.verifyCredentials(oldPassword, user.password);
  if (!passwordMatches) {
    // Password does not match
    throw new Error('Invalid Password');
  }

  // Password matches, update to new password
  await exports.update(id, { password: newPassword });

  return true;
};

/**
 * Changes a user's email
 * Checks that the correct password was provided
 * @param {Number} id User's id
 * @param {String} password User's password
 * @param {String} email Email to change to
 * @returns {Boolean} Update successful
 */
exports.changeEmail = async (id, password, email) => {
  // Make sure the password provided is correct
  // Find the user
  const result = await database.query('SELECT id, password FROM users WHERE "deletedAt" IS NULL AND id = $1', [id]);
  const user = result.rows[0];

  if (!user) {
    // No user found
    throw new Error('Invalid User');
  }

  // User found, verify password
  const passwordMatches = await AuthenticationService.verifyCredentials(password, user.password);
  if (!passwordMatches) {
    // Password does not match
    throw new Error('Invalid Password');
  }

  // Password is good, update the email
  await exports.update(id, { email: email.toLowerCase() });

  return true;
};

/**
 * Deletes a user by id
 * @param {Number} id User's id
 * @returns {Boolean} Update successful
 */
exports.softDelete = async (id) => {
  await exports.update(id, { deletedAt: new Date() });

  return true;
};
