const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const db = require('./config/db');
const { asyncHandler } = require('./utils/http');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', asyncHandler(async (req, res) => {
  const row = await db.queryOne('SELECT DB_NAME() AS DatabaseName, SYSDATETIME() AS ServerTime');
  res.json({ data: { status: 'ok', ...row } });
}));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/rooms', require('./routes/rooms.routes'));
app.use('/api/mushroom-types', require('./routes/mushroomTypes.routes'));
app.use('/api/trays', require('./routes/trays.routes'));
app.use('/api/packages', require('./routes/packages.routes'));
app.use('/api/rentals', require('./routes/rentals.routes'));
app.use('/api/my', require('./routes/my.routes'));
app.use('/api/harvests', require('./routes/harvests.routes'));
app.use('/api/deliveries', require('./routes/deliveries.routes'));
app.use('/api/devices', require('./routes/devices.routes'));
app.use('/api/sensors', require('./routes/sensors.routes'));
app.use('/api/environment', require('./routes/environment.routes'));
app.use('/api/alerts', require('./routes/alerts.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/reports', require('./routes/reports.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
