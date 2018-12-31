# Morty API 2

## About
Morty is designed to be a client agnostic CMS REST API.  Target functionality is to handle users and articles, like a bare bones WordPress.  Articles should be written using MarkDown for maximum compatibility with other clients, but you could insert HTML if you really wanted.  Morty is currently not easily extensible, but that is a future goal of the project.

## Installation
Morty runs on Node.js utilizing Hapi and PostgreSQL.  No ORM is in play here to reduce overhead and provide a high level of control.

* Install node dependencies `npm install` 
* Install [PostgreSQL](https://www.postgresql.org/)
* Install the `pg_trgm` extension: `CREATE EXTENSION pg_trgm;`
* Install the `citext` extension: `CREATE EXTENSION citext;`
* Create a Postgres database for the project, the default is "morty"
* Copy the `config.example.json` file to `config.json` and change any necessary values (**DO NOT** go with the default key)

## Config Values
* `port`: Which port the server should run on.
* `enableClustering`: If set to true, the node process will fork a worker for each available CPU on the machine.  Other clustering solutions probably do a better job.
* `database.user`: User to connect to the database with.
* `database.password`: Connecting user's password.
* `database.host`: Where the database server is located.
* `database.database`: Which database to connect to.
* `database.port`: Which port the database server is running on.
* `jwtSecret`: An example value of a secret to use to sign your JWTs with.  **Be sure to change this!**
* `jwtAlgorithm`: Which algorithm to use when signing JWTs.

## Roadmap
* Users and user roles
* Articles, categories, and tags
* File uploads
* Comments
* Documentation (swagger, generated docs)

## Need a Client?
Various versions of May are designed to interact with Morty.  Morty is currently going through a major rewrite, so there is no compatible version of May at the moment.  Morty is designed to be client agnostic, so you can roll your own if needed.