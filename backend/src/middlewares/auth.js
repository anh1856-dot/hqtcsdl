const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { HttpError, forbidden, asyncHandler } = require('../utils/http');

const unauthorized = (message) => new HttpError(401, 'UNAUTHORIZED', message);

/**
 * Bat buoc dang nhap. Doc token "Authorization: Bearer <token>",
 * kiem tra tai khoan con hoat dong, gan req.user = { id, role, fullName, email }.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Bạn chưa đăng nhập.');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  }

  // Kiem tra lai trong DB de tai khoan bi khoa/xoa mat quyen ngay
  const user = await db.queryOne(
    `SELECT u.UserId, u.FullName, u.Email, r.RoleName
     FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
     WHERE u.UserId = @id AND u.Status = 'Active' AND u.IsDeleted = 0`,
    { id: payload.sub }
  );
  if (!user) throw unauthorized('Tài khoản không tồn tại hoặc đã bị khóa.');

  req.user = { id: user.UserId, role: user.RoleName, fullName: user.FullName, email: user.Email };
  next();
});

/** Chi cho phep cac vai tro duoc liet ke: authorize('Admin', 'Operator') */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};

/** Thiet bi IoT (that hoac gia lap) gui header x-device-key */
const requireDeviceKey = (req, res, next) => {
  if (!env.IOT_DEVICE_KEY) return next(new HttpError(503, 'IOT_DISABLED', 'Chưa cấu hình IOT_DEVICE_KEY.'));
  if (req.headers['x-device-key'] !== env.IOT_DEVICE_KEY) return next(unauthorized('Khóa thiết bị không hợp lệ.'));
  next();
};

const isStaff = (user) => user.role === 'Admin' || user.role === 'Operator';

function signToken(user) {
  return jwt.sign({ sub: user.UserId, role: user.RoleName }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

module.exports = { authenticate, authorize, requireDeviceKey, isStaff, signToken };
