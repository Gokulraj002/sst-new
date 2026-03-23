'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Return JS native types for numerics
  types: (() => {
    const { types } = require('pg');
    // Cast NUMERIC to float
    types.setTypeParser(1700, (val) => parseFloat(val));
    // Cast INT8 (bigint) to int
    types.setTypeParser(20, (val) => parseInt(val, 10));
    return types;
  })(),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

/**
 * Run a query, return all rows.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]>}
 */
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Run a query, return the first row or null.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any|null>}
 */
async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

module.exports = { pool, query, queryOne };
