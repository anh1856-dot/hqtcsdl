const sql = require('mssql');
const env = require('./env');

const config = {
  server: env.DB_SERVER,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};
// Ban Express dung instance name, ban mac dinh dung port
if (env.DB_INSTANCE) config.options.instanceName = env.DB_INSTANCE;
else config.port = env.DB_PORT;

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null; // lan sau thu ket noi lai
      throw err;
    });
  }
  return poolPromise;
}

function bindInputs(request, params) {
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value === undefined ? null : value);
  }
}

/**
 * Chay cau lenh SQL co tham so, tra ve mang dong.
 *   await query('SELECT * FROM Trays WHERE RoomId = @roomId', { roomId: 1 })
 */
async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  bindInputs(request, params);
  const result = await request.query(text);
  return result.recordset || [];
}

/** Nhu query nhung chi lay dong dau tien (hoac null) */
async function queryOne(text, params = {}) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/** Tra ve tat ca result set (cau lenh co nhieu SELECT) */
async function queryMulti(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  bindInputs(request, params);
  const result = await request.query(text);
  return result.recordsets || [];
}

/**
 * Goi stored procedure.
 *   await exec('usp_RentTrays', { CustomerId: 4, PackageId: 1 }, { RentalId: sql.Int })
 * Tra ve { recordset, recordsets, output }
 */
async function exec(procName, params = {}, outputs = {}) {
  const pool = await getPool();
  const request = pool.request();
  bindInputs(request, params);
  for (const [name, type] of Object.entries(outputs)) request.output(name, type);
  const result = await request.execute(procName);
  return {
    recordset: result.recordset || [],
    recordsets: result.recordsets || [],
    output: result.output || {},
  };
}

async function close() {
  if (poolPromise) {
    const pool = await poolPromise;
    poolPromise = null;
    await pool.close();
  }
}

module.exports = { sql, getPool, query, queryOne, queryMulti, exec, close };
