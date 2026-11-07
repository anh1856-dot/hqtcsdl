const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');

async function completeExpiredRentals() {
  try {
    const { recordset } = await db.exec('dbo.usp_CompleteExpiredRentals');
    if (recordset.length) console.log(`[scheduler] Đã đóng ${recordset.length} đơn thuê hết hạn`);
  } catch (err) {
    console.error('[scheduler] Lỗi đóng đơn thuê hết hạn:', err.message);
  }
}

async function start() {
  try {
    await db.getPool();
    console.log(`Đã kết nối SQL Server: ${env.DB_SERVER}${env.DB_INSTANCE ? '\\' + env.DB_INSTANCE : ':' + env.DB_PORT} / ${env.DB_NAME}`);
  } catch (err) {
    console.error('Không kết nối được SQL Server:', err.message);
    console.error('Kiểm tra: SQL Server bật TCP/IP, bật SQL Server Authentication, thông tin trong file .env');
    process.exit(1);
  }

  app.listen(env.PORT, () => console.log(`API đang chạy: http://localhost:${env.PORT}/api`));

  if (env.ENABLE_SCHEDULER) {
    setTimeout(completeExpiredRentals, 10_000);
    setInterval(completeExpiredRentals, 24 * 60 * 60 * 1000);
  }
}

start();
