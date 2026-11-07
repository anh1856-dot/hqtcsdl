const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, signToken } = require('../middlewares/auth');
const { HttpError, badRequest, forbidden, asyncHandler } = require('../utils/http');
const { requireFields, isEmail } = require('../utils/validate');

const PROFILE_SQL = `
  SELECT u.UserId, u.FullName, u.Email, u.Phone, u.Address, u.AvatarUrl, r.RoleName AS Role,
         u.Status, u.CreatedAt, u.LastLoginAt
  FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
  WHERE u.UserId = @id`;

// POST /api/auth/register - khach hang tu dang ky
router.post('/register', asyncHandler(async (req, res) => {
  const { fullName, email, password, phone, address } = req.body;
  requireFields(req.body, ['fullName', 'email', 'password']);
  if (!isEmail(email)) throw badRequest('Email không hợp lệ.');
  if (String(password).length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

  const hash = await bcrypt.hash(password, 10);
  const created = await db.queryOne(
    // Bang Users co trigger nen khong dung OUTPUT, lay id bang SCOPE_IDENTITY()
    `INSERT INTO dbo.Users (RoleId, FullName, Email, Phone, PasswordHash, Address)
     SELECT RoleId, @fullName, @email, @phone, @hash, @address FROM dbo.Roles WHERE RoleName = 'Customer';
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS UserId;`,
    { fullName, email: email.trim().toLowerCase(), phone: phone || null, hash, address: address || null }
  );

  const user = await db.queryOne(PROFILE_SQL, { id: created.UserId });
  res.status(201).json({ data: { token: signToken({ UserId: user.UserId, RoleName: user.Role }), user } });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  requireFields(req.body, ['email', 'password']);

  const found = await db.queryOne(
    `SELECT u.UserId, u.PasswordHash, u.Status, r.RoleName
     FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
     WHERE u.Email = @email AND u.IsDeleted = 0`,
    { email: String(email).trim().toLowerCase() }
  );
  const ok = found && (await bcrypt.compare(String(password), found.PasswordHash));
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  if (found.Status !== 'Active') throw forbidden('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');

  await db.query('UPDATE dbo.Users SET LastLoginAt = SYSDATETIME() WHERE UserId = @id', { id: found.UserId });
  const user = await db.queryOne(PROFILE_SQL, { id: found.UserId });
  res.json({ data: { token: signToken(found), user } });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ data: await db.queryOne(PROFILE_SQL, { id: req.user.id }) });
}));

// PUT /api/auth/me - cap nhat ho so cua chinh minh
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { fullName, phone, address, avatarUrl } = req.body;
  if (fullName !== undefined && !String(fullName).trim()) throw badRequest('Họ tên không được để trống.');

  await db.query(
    `UPDATE dbo.Users
     SET FullName  = COALESCE(@fullName, FullName),
         Phone     = CASE WHEN @setPhone = 1 THEN @phone ELSE Phone END,
         Address   = CASE WHEN @setAddress = 1 THEN @address ELSE Address END,
         AvatarUrl = CASE WHEN @setAvatar = 1 THEN @avatarUrl ELSE AvatarUrl END,
         UpdatedAt = SYSDATETIME()
     WHERE UserId = @id`,
    {
      id: req.user.id,
      fullName: fullName ?? null,
      setPhone: phone !== undefined ? 1 : 0, phone: phone || null,
      setAddress: address !== undefined ? 1 : 0, address: address || null,
      setAvatar: avatarUrl !== undefined ? 1 : 0, avatarUrl: avatarUrl || null,
    }
  );
  res.json({ data: await db.queryOne(PROFILE_SQL, { id: req.user.id }) });
}));

// PUT /api/auth/me/password - doi mat khau
router.put('/me/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  requireFields(req.body, ['currentPassword', 'newPassword']);
  if (String(newPassword).length < 6) throw badRequest('Mật khẩu mới phải có ít nhất 6 ký tự.');

  const row = await db.queryOne('SELECT PasswordHash FROM dbo.Users WHERE UserId = @id', { id: req.user.id });
  if (!(await bcrypt.compare(String(currentPassword), row.PasswordHash))) {
    throw badRequest('Mật khẩu hiện tại không đúng.');
  }
  await db.query('UPDATE dbo.Users SET PasswordHash = @hash, UpdatedAt = SYSDATETIME() WHERE UserId = @id',
    { id: req.user.id, hash: await bcrypt.hash(newPassword, 10) });
  res.json({ data: { message: 'Đã đổi mật khẩu.' } });
}));

module.exports = router;
