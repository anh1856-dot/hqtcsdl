/*
 * Gia lap thiet bi IoT: moi SIM_INTERVAL_SEC giay, moi cam bien gui nhiet do / do am / CO2 len API.
 * Moi truong "phan ung" voi thiet bi: quat bat -> giam nhiet, giam CO2; phun suong bat -> tang do am;
 * suoi bat -> tang nhiet. Thinh thoang tao gia tri bat thuong de test canh bao.
 *
 * Chay (backend phai dang chay):  npm run simulate
 * Bien moi truong (file .env): API_URL, IOT_DEVICE_KEY, SIM_INTERVAL_SEC (mac dinh 5), SIM_ANOMALY (mac dinh 0.05)
 */
require('dotenv').config();

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const KEY = process.env.IOT_DEVICE_KEY;
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_SEC || 5) * 1000;
const ANOMALY_RATE = Number(process.env.SIM_ANOMALY || 0.05);

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, d = 2) => Number(v.toFixed(d));

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-device-key': KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${json.error ? json.error.message : res.statusText}`);
  return json.data;
}

function threshold(sensor, metric, fallback) {
  const t = sensor.thresholds.find((x) => x.Metric === metric);
  return t ? { min: t.MinValue, max: t.MaxValue } : fallback;
}

function initState(sensor) {
  const T = threshold(sensor, 'Temperature', { min: 18, max: 26 });
  const H = threshold(sensor, 'Humidity', { min: 80, max: 95 });
  const C = threshold(sensor, 'CO2', { min: 400, max: 1000 });
  return {
    code: sensor.DeviceCode, room: sensor.RoomCode, T, H, C,
    temp: (T.min + T.max) / 2, hum: (H.min + H.max) / 2, co2: (C.min + C.max) / 2,
    on: Object.fromEntries(sensor.actuators.map((a) => [a.DeviceType, a.IsOn])),
  };
}

function step(s) {
  // Bien dong tu nhien: do am giam dan, CO2 tang dan (nam ho hap)
  s.temp += rand(-0.3, 0.3);
  s.hum += rand(-1, 0.6);
  s.co2 += rand(-10, 35);

  // Thiet bi tac dong
  if (s.on.Fan) { s.temp -= 0.4; s.co2 -= 90; s.hum -= 0.5; }
  if (s.on.MistSprayer) s.hum += 2.5;
  if (s.on.Heater) s.temp += 0.6;

  // Thinh thoang bat thuong de kiem tra canh bao
  if (Math.random() < ANOMALY_RATE) {
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) s.temp = Math.random() < 0.5 ? s.T.max + rand(1, 3) : s.T.min - rand(1, 3);
    if (pick === 1) s.hum = s.H.min - rand(3, 10);
    if (pick === 2) s.co2 = s.C.max + rand(100, 500);
  }

  s.temp = clamp(s.temp, -10, 60);
  s.hum = clamp(s.hum, 30, 100);
  s.co2 = clamp(s.co2, 350, 5000);
}

async function tick(states) {
  for (const s of states) {
    step(s);
    try {
      const data = await api('POST', '/sensors/readings', {
        deviceCode: s.code, temperature: round(s.temp), humidity: round(s.hum), co2: round(s.co2, 1),
      });
      // Cap nhat trang thai thiet bi (trigger trong DB co the vua bat/tat)
      for (const a of data.actuators) s.on[a.DeviceType] = a.IsOn;
      const devices = data.actuators
        .filter((a) => a.DeviceType !== 'GrowLight')
        .map((a) => `${a.DeviceType}:${a.IsOn ? 'ON ' : 'off'}`).join(' ');
      console.log(`${new Date().toLocaleTimeString()} ${s.room} T=${round(s.temp, 1)}°C H=${round(s.hum, 1)}% CO2=${Math.round(s.co2)}ppm | ${devices}`);
    } catch (err) {
      console.error(`${new Date().toLocaleTimeString()} ${s.code} lỗi: ${err.message}`);
    }
  }
}

async function main() {
  if (!KEY) throw new Error('Thiếu IOT_DEVICE_KEY trong file .env');
  const sensors = await api('GET', '/sensors/config');
  if (!sensors.length) throw new Error('Không có cảm biến nào đang hoạt động.');
  const states = sensors.map(initState);
  console.log(`Giả lập ${states.length} cảm biến (${states.map((s) => s.code).join(', ')}), mỗi ${INTERVAL_MS / 1000}s. Ctrl+C để dừng.`);
  await tick(states);
  setInterval(() => tick(states), INTERVAL_MS);
}

main().catch((err) => {
  console.error('Không chạy được giả lập:', err.message);
  process.exit(1);
});
