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
    // DB luu gio dia phuong (SYSDATETIME), khong phai UTC.
    // Mac dinh mssql coi moi gia tri datetime la UTC -> API tra lech mui gio.
    useUTC: false,
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

/*
 * Cot kieu DATE (ngay thue, ngay het han, lich thu hoach...) la "ngay lich", khong co gio.
 * mssql tra ve Date luc 00:00 gio dia phuong, JSON hoa thanh "...T17:00:00.000Z" cua ngay hom truoc
 * -> web/app cat 10 ky tu dau se lui 1 ngay. Doi ve chuoi 'YYYY-MM-DD' dung nhu trong database.
 * Cot DATETIME2 (thoi diem) giu nguyen Date -> JSON ISO co 'Z', dung thoi diem.
 */
const pad = (n) => String(n).padStart(2, '0');
function toDateOnly(value) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
function fixDateColumns(recordset) {
  if (!recordset || !recordset.columns) return recordset;
  const dateCols = Object.values(recordset.columns)
    .filter((c) => c.type === sql.Date || c.type?.declaration === 'date')
    .map((c) => c.name);
  if (!dateCols.length) return recordset;
  for (const row of recordset) {
    for (const name of dateCols) {
      if (row[name] instanceof Date) row[name] = toDateOnly(row[name]);
    }
  }
  return recordset;
}
function fixOutputDates(output) {
  for (const [key, value] of Object.entries(output || {})) {
    // Tham so OUTPUT kieu Date (vd NewEndDate) khong co metadata -> chi doi khi dung 00:00 gio dia phuong
    if (value instanceof Date && !value.getHours() && !value.getMinutes() && !value.getSeconds() && !value.getMilliseconds()) {
      output[key] = toDateOnly(value);
    }
  }
  return output;
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
  return fixDateColumns(result.recordset) || [];
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
  return (result.recordsets || []).map(fixDateColumns);
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
  const recordsets = (result.recordsets || []).map(fixDateColumns);
  return {
    recordset: recordsets[0] || [],
    recordsets,
    output: fixOutputDates(result.output || {}),
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
