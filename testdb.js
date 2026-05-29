const sql = require('mssql');

const config = {
  server: 'localhost\\SQLEXPRESS',
  database: 'Medicare_Portal',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
    encrypt: false,
  },
  connectionTimeout: 30000,
};
async function testConnection() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT @@SERVERNAME AS server');
    console.log('✅ Connected! Server:', result.recordset[0].server);
    sql.close();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection();