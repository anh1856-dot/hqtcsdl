require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
}

const env = {
  PORT: Number(process.env.PORT || 3000),

  DB_SERVER: process.env.DB_SERVER || 'localhost',
  DB_INSTANCE: process.env.DB_INSTANCE || '',
  DB_PORT: Number(process.env.DB_PORT || 1433),
  DB_NAME: process.env.DB_NAME || 'MushroomFarmDB',
  DB_USER: process.env.DB_USER || 'mushroom_app',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_ENCRYPT: bool(process.env.DB_ENCRYPT, true),
  DB_TRUST_SERVER_CERTIFICATE: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  IOT_DEVICE_KEY: process.env.IOT_DEVICE_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ENABLE_SCHEDULER: bool(process.env.ENABLE_SCHEDULER, true),
};

if (!env.JWT_SECRET) {
  throw new Error('Thiếu JWT_SECRET trong file .env (copy từ .env.example)');
}

module.exports = env;
