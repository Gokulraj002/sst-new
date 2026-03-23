'use strict';

const app = require('./src/app');

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n  SST ERP backend running on http://localhost:${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Frontend    : ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`  Database    : ${(process.env.DATABASE_URL || '').replace(/:([^:@]+)@/, ':****@')}\n`);
});
