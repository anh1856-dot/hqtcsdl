const { badRequest } = require('./http');

/** Bao loi neu thieu truong bat buoc */
function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw badRequest(`Thiếu thông tin: ${missing.join(', ')}`, { missing });
}

function toInt(value, name, { min, max, optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw badRequest(`${name} phải là số nguyên.`);
  if (min !== undefined && n < min) throw badRequest(`${name} phải >= ${min}.`);
  if (max !== undefined && n > max) throw badRequest(`${name} phải <= ${max}.`);
  return n;
}

function toNumber(value, name, { min, max, optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${name} phải là số.`);
  if (min !== undefined && n < min) throw badRequest(`${name} phải >= ${min}.`);
  if (max !== undefined && n > max) throw badRequest(`${name} phải <= ${max}.`);
  return n;
}

function oneOf(value, list, name, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (!list.includes(value)) throw badRequest(`${name} phải là một trong: ${list.join(', ')}`);
  return value;
}

function toBool(value, name) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw badRequest(`${name} phải là true/false.`);
}

/** Chuoi ngay YYYY-MM-DD */
function toDate(value, name, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(value))) {
    throw badRequest(`${name} phải có dạng YYYY-MM-DD.`);
  }
  return String(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

module.exports = { requireFields, toInt, toNumber, oneOf, toBool, toDate, isEmail };
