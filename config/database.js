const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'rased_db',
  user: 'postgres',
  password: '30312081200099S_s', 
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // 👇 أضف هذا السطر هنا
  client_encoding: 'UTF8', 
});

pool.on('connect', (client) => {
  // 👇 وأضف هذا السطر للتأكيد الإضافي عند كل اتصال جديد
  client.query('SET client_encoding TO "UTF8"');
  console.log('📊 Connected to PostgreSQL database (UTF8)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

module.exports = pool;