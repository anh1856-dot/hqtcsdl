import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../util.dart';

String _roomState(List<dynamic> envRows, dynamic roomName, Metric m) {
  for (final r in envRows) {
    final row = asMap(r);
    if (row['RoomName'] == roomName) return (row[m.st] ?? 'Normal').toString();
  }
  return 'Normal';
}

class TraysScreen extends StatelessWidget {
  final VoidCallback onGoRent;
  const TraysScreen({super.key, required this.onGoRent});

  Future<void> _linkTray(BuildContext context, Future<void> Function() reload) async {
    final ctl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) {
        String? err;
        bool busy = false;
        return StatefulBuilder(builder: (c, setS) {
          return AlertDialog(
            title: const Text('Nhập mã khay'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                    'Nhập mã in trên khay do trại nấm gán cho bạn (ví dụ TRAY-R01-013).',
                    style: TextStyle(fontSize: 13, color: Colors.black54)),
                if (err != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(err!, style: TextStyle(color: Colors.red.shade700)),
                  ),
                const SizedBox(height: 10),
                TextField(
                  controller: ctl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(labelText: 'Mã khay'),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        final code = ctl.text.trim();
                        if (code.isEmpty) {
                          setS(() => err = 'Vui lòng nhập mã khay.');
                          return;
                        }
                        setS(() => busy = true);
                        try {
                          await Api.i.post('/rentals/link', {'trayCode': code});
                          if (c.mounted) Navigator.pop(c, true);
                        } catch (e) {
                          setS(() {
                            err = e.toString();
                            busy = false;
                          });
                        }
                      },
                child: const Text('Liên kết'),
              ),
            ],
          );
        });
      },
    );
    if (ok == true) {
      if (context.mounted) toast(context, 'Đã liên kết khay ${ctl.text.trim().toUpperCase()}');
      await reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      autoRefresh: const Duration(seconds: 30),
      load: () async {
        final results = await Future.wait([
          Api.i.get('/my/trays'),
          Api.i.getSafe('/environment'),
        ]);
        return {'trays': asList(results[0]['data']), 'env': asList(results[1]['data'])};
      },
      builder: (context, data, reload) {
        final list = asList(data['trays']);
        final env = asList(data['env']);
        if (list.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              EmptyBox(
                '🌱',
                'Bạn chưa có khay nào.',
                action: Wrap(
                  spacing: 8,
                  children: [
                    FilledButton(onPressed: onGoRent, child: const Text('Thuê khay')),
                    OutlinedButton(
                        onPressed: () => _linkTray(context, reload),
                        child: const Text('Nhập mã khay')),
                  ],
                ),
              ),
            ],
          );
        }
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Khay đang thuê (${list.length})',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                OutlinedButton(
                    onPressed: () => _linkTray(context, reload),
                    child: const Text('+ Nhập mã khay')),
              ],
            ),
            const SizedBox(height: 8),
            for (final raw in list) _TrayCard(asMap(raw), env, reload),
          ],
        );
      },
    );
  }
}

class _TrayCard extends StatelessWidget {
  final Map<String, dynamic> t;
  final List<dynamic> env;
  final Future<void> Function() reload;
  const _TrayCard(this.t, this.env, this.reload);

  @override
  Widget build(BuildContext context) {
    final warn = metrics.any((m) =>
        t[m.key] != null && _roomState(env, t['RoomName'], m) != 'Normal');
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => TrayDetailScreen(trayId: t['TrayId'].toString())),
          );
          reload();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(t['TrayCode'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Pill(vi(trayStatusVi, t['Status']),
                      color: t['Status'] == 'ReadyToHarvest' ? Colors.orange.shade800 : kGreen),
                ],
              ),
              Text('${t['TypeName'] ?? 'Chưa chọn loại nấm'} · ${t['RoomName'] ?? ''}',
                  style: const TextStyle(fontSize: 13, color: Colors.black54)),
              StageBar(t['Stage']?.toString()),
              const SizedBox(height: 8),
              Text(daysText(t), style: const TextStyle(fontSize: 13, color: Colors.black54)),
              if (t['Temperature'] != null) ...[
                const SizedBox(height: 6),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  children: [
                    Text(
                        '🌡 ${fmtNum(t['Temperature'])}°C · 💧 ${fmtNum(t['Humidity'])}% · CO₂ ${fmtNum(t['CO2'], 0)} ppm',
                        style: const TextStyle(fontSize: 13)),
                    if (warn) Pill('Ngoài ngưỡng', color: Colors.orange.shade800),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ======================= Chi tiết khay =======================

class TrayDetailScreen extends StatefulWidget {
  final String trayId;
  const TrayDetailScreen({super.key, required this.trayId});
  @override
  State<TrayDetailScreen> createState() => _TrayDetailScreenState();
}

class _TrayDetailScreenState extends State<TrayDetailScreen> {
  Metric _metric = metrics[0];
  int _hours = 24;

  Future<Map<String, dynamic>> _load() async {
    final results = await Future.wait([
      Api.i.get('/my/trays/${Uri.encodeComponent(widget.trayId)}'),
      Api.i.getSafe('/environment'),
    ]);
    final t = asMap(results[0]['data']);
    // /my/trays không trả RoomId nên tra theo tên phòng
    t['RoomId'] = null;
    for (final r in asList(results[1]['data'])) {
      final row = asMap(r);
      if (row['RoomName'] == t['RoomName']) {
        t['RoomId'] = row['RoomId'];
        break;
      }
    }
    return t;
  }

  Map<String, dynamic> _envOf(Map<String, dynamic> t) {
    final th = <String, Map<String, dynamic>>{};
    for (final x in asList(t['thresholds'])) {
      final row = asMap(x);
      th[row['Metric'].toString()] = row;
    }
    final env = <String, dynamic>{};
    for (final m in metrics) {
      final x = th[m.id];
      final v = toD(t[m.key]);
      env[m.key] = v;
      env[m.min] = x?['MinValue'];
      env[m.max] = x?['MaxValue'];
      final lo = toD(x?['MinValue']);
      final hi = toD(x?['MaxValue']);
      env[m.st] = (v == null || lo == null || hi == null)
          ? 'Normal'
          : (v < lo ? 'Low' : (v > hi ? 'High' : 'Normal'));
    }
    return env;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết khay')),
      body: AsyncView<Map<String, dynamic>>(
        load: _load,
        builder: (context, t, reload) {
          final env = _envOf(t);
          final logs = asList(t['growthLogs']);
          final harvests = asList(t['harvests']);
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(12),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(t['TrayCode'].toString(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 18)),
                          Pill(vi(trayStatusVi, t['Status'])),
                        ],
                      ),
                      Text('${t['TypeName'] ?? 'Chưa chọn loại nấm'} · ${t['RoomName'] ?? ''}',
                          style: const TextStyle(fontSize: 13, color: Colors.black54)),
                      StageBar(t['Stage']?.toString()),
                      const SizedBox(height: 10),
                      Text('Thu hoạch: ${daysText(t)}'),
                      Text('Hạn thuê: đến ${fmtDate(t['RentalEndDate'])}'),
                      if (t['CameraUrl'] != null && t['CameraUrl'].toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: TextButton.icon(
                            onPressed: () {
                              final u = Uri.tryParse(t['CameraUrl'].toString());
                              if (u != null && (u.scheme == 'http' || u.scheme == 'https')) {
                                launchUrl(u, mode: LaunchMode.externalApplication);
                              }
                            },
                            icon: const Icon(Icons.videocam),
                            label: const Text('Xem camera trực tiếp'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              SectionTitle('Môi trường · ${t['RoomName'] ?? ''}'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cập nhật: ${fmtDateTime(t['EnvRecordedAt'])}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      const SizedBox(height: 8),
                      MetricsBlock(env, withRange: true),
                      const Divider(height: 24),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final m in metrics)
                            ChoiceChip(
                              label: Text(m.label),
                              selected: _metric.id == m.id,
                              onSelected: (_) => setState(() => _metric = m),
                            ),
                          for (final h in const [24, 168])
                            ChoiceChip(
                              label: Text(h == 24 ? '24 giờ' : '7 ngày'),
                              selected: _hours == h,
                              onSelected: (_) => setState(() => _hours = h),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      EnvChart(
                        key: ValueKey('${t['RoomId']}-${_metric.id}-$_hours'),
                        roomId: t['RoomId']?.toString(),
                        metric: _metric,
                        hours: _hours,
                      ),
                    ],
                  ),
                ),
              ),
              const SectionTitle('Nhật ký sinh trưởng'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: logs.isEmpty
                      ? const Text('Chưa có nhật ký.',
                          style: TextStyle(color: Colors.black54))
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final raw in logs) _logItem(asMap(raw)),
                          ],
                        ),
                ),
              ),
              const SectionTitle('Thu hoạch'),
              if (harvests.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(14),
                    child: Text('Chưa có lịch thu hoạch.',
                        style: TextStyle(color: Colors.black54)),
                  ),
                )
              else
                for (final raw in harvests) _harvestItem(asMap(raw)),
            ],
          );
        },
      ),
    );
  }

  Widget _logItem(Map<String, dynamic> l) {
    final img = l['ImageUrl']?.toString() ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(vi(stageVi, l['Stage']), style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(fmtDateTime(l['LoggedAt']),
              style: const TextStyle(fontSize: 12, color: Colors.black54)),
          if (l['Note'] != null && l['Note'].toString().isNotEmpty) Text(l['Note'].toString()),
          if (RegExp(r'^https?://', caseSensitive: false).hasMatch(img))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(img,
                    height: 160,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink()),
              ),
            ),
        ],
      ),
    );
  }

  Widget _harvestItem(Map<String, dynamic> h) {
    final done = h['Status'] == 'Completed';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                    done
                        ? fmtDate(h['HarvestedAt'])
                        : 'Dự kiến ${fmtDate(h['ScheduledDate'])}',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                Pill(vi(harvestVi, h['Status']), color: done ? kGreen : Colors.grey),
              ],
            ),
            if (done)
              Text('Khối lượng ${fmtNum(h['WeightKg'], 2)} kg · loại ${h['Quality'] ?? '–'}'),
            if (h['DeliveryStatus'] != null)
              Text('Giao nhận: ${vi(deliveryVi, h['DeliveryStatus'])}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }
}

// ======================= Chỉ số môi trường & biểu đồ =======================

class MetricsBlock extends StatelessWidget {
  final Map<String, dynamic> env;
  final bool withRange;
  const MetricsBlock(this.env, {super.key, this.withRange = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final m in metrics)
          Expanded(child: _tile(m)),
      ],
    );
  }

  Widget _tile(Metric m) {
    final v = env[m.key];
    final st = v == null ? 'Normal' : (env[m.st] ?? 'Normal').toString();
    final color = st == 'High'
        ? Colors.red.shade700
        : st == 'Low'
            ? Colors.blue.shade700
            : kGreen;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.35)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text('${fmtNum(v, m.decimals)} ${m.unit}',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: color)),
          Text(m.label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          if (v != null) Text(vi(stateVi, st), style: TextStyle(fontSize: 11, color: color)),
          if (withRange && env[m.min] != null && env[m.max] != null)
            Text('${fmtNum(env[m.min], 0)} – ${fmtNum(env[m.max], 0)}',
                style: const TextStyle(fontSize: 11, color: Colors.black45)),
        ],
      ),
    );
  }
}

class EnvChart extends StatelessWidget {
  final String? roomId;
  final Metric metric;
  final int hours;
  const EnvChart({super.key, required this.roomId, required this.metric, required this.hours});

  Future<List<List<double>>> _load() async {
    if (roomId == null || roomId!.isEmpty) return [];
    final base = '/environment/${Uri.encodeComponent(roomId!)}/history?hours=$hours';
    var r = await Api.i.get('$base&groupBy=hour');
    var rows = asList(r['data']);
    if (rows.length < 3) {
      r = await Api.i.get('$base&groupBy=none');
      rows = asList(r['data']);
    }
    final pts = <List<double>>[];
    for (final raw in rows) {
      final row = asMap(raw);
      final t = parseUtc(row['Time']);
      final v = toD(row[metric.key]);
      if (t != null && v != null) pts.add([t.millisecondsSinceEpoch.toDouble(), v]);
    }
    return pts;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<List<double>>>(
      future: _load(),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const SizedBox(
              height: 150, child: Center(child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return Text(snap.error.toString(),
              style: const TextStyle(fontSize: 12, color: Colors.black54));
        }
        final pts = snap.data ?? [];
        if (pts.length < 2) {
          return const Text('Chưa đủ dữ liệu để vẽ biểu đồ.',
              style: TextStyle(fontSize: 12, color: Colors.black54));
        }
        final vs = pts.map((p) => p[1]).toList();
        final lo = vs.reduce((a, b) => a < b ? a : b);
        final hi = vs.reduce((a, b) => a > b ? a : b);
        return Column(
          children: [
            SizedBox(
              height: 170,
              width: double.infinity,
              child: CustomPaint(painter: _LinePainter(pts, metric.color, metric.decimals)),
            ),
            const SizedBox(height: 4),
            Text(
                '${metric.label} (${metric.unit}) · thấp nhất ${lo.toStringAsFixed(1)} · cao nhất ${hi.toStringAsFixed(1)}',
                style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        );
      },
    );
  }
}

class _LinePainter extends CustomPainter {
  final List<List<double>> pts; // [millis, value]
  final Color color;
  final int decimals;
  _LinePainter(this.pts, this.color, this.decimals);

  void _text(Canvas c, String s, Offset o, {bool right = false, bool center = false}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: const TextStyle(fontSize: 10, color: Colors.black54)),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = right ? o.dx - tp.width : (center ? o.dx - tp.width / 2 : o.dx);
    tp.paint(c, Offset(dx, o.dy));
  }

  String _fmtT(double ms) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms.round(), isUtc: true);
    String p(int n) => n.toString().padLeft(2, '0');
    return '${p(d.day)}/${p(d.month)} ${p(d.hour)}:${p(d.minute)}';
  }

  @override
  void paint(Canvas canvas, Size size) {
    const l = 38.0, r = 8.0, t = 8.0, b = 22.0;
    final vs = pts.map((p) => p[1]).toList();
    var lo = vs.reduce((a, c) => a < c ? a : c);
    var hi = vs.reduce((a, c) => a > c ? a : c);
    if (hi - lo < 1) {
      lo -= 1;
      hi += 1;
    }
    final pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    final t0 = pts.first[0];
    final t1 = pts.last[0] == t0 ? t0 + 1 : pts.last[0];
    final w = size.width - l - r;
    final h = size.height - t - b;
    double x(double ms) => l + (ms - t0) / (t1 - t0) * w;
    double y(double v) => t + (1 - (v - lo) / (hi - lo)) * h;

    final grid = Paint()
      ..color = const Color(0xFFE6E2D6)
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final v = lo + (hi - lo) * i / 3;
      final yy = y(v);
      canvas.drawLine(Offset(l, yy), Offset(size.width - r, yy), grid);
      _text(canvas, v.toStringAsFixed(decimals), Offset(l - 4, yy - 6), right: true);
    }

    final line = Path();
    for (var i = 0; i < pts.length; i++) {
      final px = x(pts[i][0]);
      final py = y(pts[i][1]);
      if (i == 0) {
        line.moveTo(px, py);
      } else {
        line.lineTo(px, py);
      }
    }
    final area = Path.from(line)
      ..lineTo(x(pts.last[0]), size.height - b)
      ..lineTo(x(pts.first[0]), size.height - b)
      ..close();
    canvas.drawPath(area, Paint()..color = color.withOpacity(0.12));
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawCircle(Offset(x(pts.last[0]), y(pts.last[1])), 3.5, Paint()..color = color);

    _text(canvas, _fmtT(t0), Offset(l, size.height - 14));
    _text(canvas, _fmtT(pts.last[0]), Offset(size.width - r, size.height - 14), right: true);
  }

  @override
  bool shouldRepaint(covariant _LinePainter old) =>
      old.pts != pts || old.color != color;
}
