import 'dart:async';

import 'package:flutter/material.dart';

// ---------- Hằng số hiển thị ----------
const stages = ['Inoculation', 'Incubation', 'Pinning', 'Fruiting', 'Harvest'];
const stageVi = {
  'Inoculation': 'Cấy giống',
  'Incubation': 'Ủ tơ',
  'Pinning': 'Ra nụ',
  'Fruiting': 'Quả thể',
  'Harvest': 'Thu hoạch',
};
const trayStatusVi = {
  'Available': 'Trống',
  'Rented': 'Đã thuê',
  'Growing': 'Đang trồng',
  'ReadyToHarvest': 'Sắp thu hoạch',
  'Harvested': 'Đã thu hoạch',
  'Maintenance': 'Bảo trì',
};
const stateVi = {'Low': 'Thấp', 'High': 'Cao', 'Normal': 'Ổn định'};
const deliveryVi = {
  'Pending': 'Chờ xử lý',
  'Confirmed': 'Đã xác nhận',
  'Shipping': 'Đang giao',
  'Completed': 'Hoàn tất',
  'Cancelled': 'Đã hủy',
};
const harvestVi = {
  'Scheduled': 'Đã lên lịch',
  'Completed': 'Đã thu hoạch',
  'Cancelled': 'Đã hủy',
};
const rentalVi = {
  'Pending': 'Chờ xử lý',
  'Active': 'Đang thuê',
  'Completed': 'Đã kết thúc',
  'Cancelled': 'Đã hủy',
};
const payVi = {
  'Cash': 'Tiền mặt',
  'BankTransfer': 'Chuyển khoản',
  'EWallet': 'Ví điện tử',
  'Card': 'Thẻ',
};
const payStatusVi = {
  'Pending': 'Chờ',
  'Paid': 'Đã thanh toán',
  'Failed': 'Thất bại',
  'Refunded': 'Đã hoàn',
};
const notifIcon = {
  'Alert': '⚠️',
  'Progress': '🌱',
  'HarvestReady': '🧺',
  'Rental': '🧾',
  'Delivery': '🚚',
  'System': '📢',
};
const notifName = {
  'Alert': 'Cảnh báo',
  'Progress': 'Tiến độ',
  'HarvestReady': 'Sắp thu hoạch',
  'Rental': 'Thuê khay',
  'Delivery': 'Giao nhận',
  'System': 'Hệ thống',
};

class Metric {
  final String id, label, unit, key, st, min, max;
  final Color color;
  final int decimals;
  const Metric(this.id, this.label, this.unit, this.key, this.st, this.min,
      this.max, this.color, this.decimals);
}

const metrics = [
  Metric('Temperature', 'Nhiệt độ', '°C', 'Temperature', 'TempState', 'TempMin',
      'TempMax', Color(0xFFD9662B), 1),
  Metric('Humidity', 'Độ ẩm', '%', 'Humidity', 'HumState', 'HumMin', 'HumMax',
      Color(0xFF2A7FB8), 1),
  Metric('CO2', 'CO₂', 'ppm', 'CO2', 'CO2State', 'CO2Min', 'CO2Max',
      Color(0xFF7A6A3A), 0),
];

const kGreen = Color(0xFF2E7D4F);
const kBg = Color(0xFFF6F3EA);

// ---------- Định dạng ----------
double? toD(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

int toI(dynamic v) => toD(v)?.round() ?? 0;

String fmtNum(dynamic v, [int d = 1]) {
  final x = toD(v);
  return x == null ? '–' : x.toStringAsFixed(d);
}

String fmtMoney(dynamic n) {
  final v = (toD(n) ?? 0).round();
  final s = v.abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return '${v < 0 ? '-' : ''}${b.toString()}đ';
}

/// Giờ trong DB là giờ địa phương của máy chủ SQL nên hiển thị nguyên giá trị (coi như UTC).
DateTime? parseUtc(dynamic v) {
  if (v == null) return null;
  final d = DateTime.tryParse(v.toString());
  if (d == null) return null;
  if (d.isUtc) return d;
  return DateTime.utc(
      d.year, d.month, d.day, d.hour, d.minute, d.second, d.millisecond);
}

String _p2(int n) => n.toString().padLeft(2, '0');

String fmtDate(dynamic v) {
  final d = parseUtc(v);
  if (d == null) return '–';
  return '${_p2(d.day)}/${_p2(d.month)}/${d.year}';
}

String fmtDateTime(dynamic v) {
  final d = parseUtc(v);
  if (d == null) return '–';
  return '${_p2(d.hour)}:${_p2(d.minute)} ${_p2(d.day)}/${_p2(d.month)}';
}

String isoDate(DateTime d) => '${d.year}-${_p2(d.month)}-${_p2(d.day)}';

String vi(Map<String, String> map, dynamic key) {
  final k = key?.toString() ?? '';
  return map[k] ?? k;
}

String daysText(Map<String, dynamic> t) {
  final d = t['DaysToHarvest'];
  if (d == null) {
    return t['ExpectedHarvestDate'] != null
        ? 'Dự kiến ${fmtDate(t['ExpectedHarvestDate'])}'
        : 'Chưa có lịch thu hoạch';
  }
  if (toI(d) <= 0) return 'Đến hạn thu hoạch';
  return 'Còn ${toI(d)} ngày (dự kiến ${fmtDate(t['ExpectedHarvestDate'])})';
}

// ---------- Widget dùng chung ----------
void toast(BuildContext context, String msg, {bool err = false}) {
  final m = ScaffoldMessenger.of(context);
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: err ? Colors.red.shade700 : null,
    duration: Duration(seconds: err ? 4 : 2),
  ));
}

Future<bool> confirmBox(BuildContext context, String title, String text,
    [String ok = 'Đồng ý']) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(ok)),
      ],
    ),
  );
  return r == true;
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 14, 2, 6),
        child: Text(text,
            style: const TextStyle(
                fontWeight: FontWeight.w700, fontSize: 14, color: Colors.black54)),
      );
}

class Pill extends StatelessWidget {
  final String text;
  final Color color;
  const Pill(this.text, {super.key, this.color = kGreen});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: color.withOpacity(0.14),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text,
            style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
      );
}

class StageBar extends StatelessWidget {
  final String? stage;
  const StageBar(this.stage, {super.key});
  @override
  Widget build(BuildContext context) {
    final idx = stages.indexOf(stage ?? '');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Row(
          children: [
            for (var i = 0; i < stages.length; i++)
              Expanded(
                child: Container(
                  height: 6,
                  margin: const EdgeInsets.only(right: 3),
                  decoration: BoxDecoration(
                    color: i < idx
                        ? kGreen
                        : i == idx
                            ? const Color(0xFF8BC34A)
                            : Colors.black12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 3),
        Row(
          children: [
            for (var i = 0; i < stages.length; i++)
              Expanded(
                child: Text(stageVi[stages[i]]!,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: i == idx ? FontWeight.w700 : FontWeight.normal,
                        color: i == idx ? kGreen : Colors.black45)),
              ),
          ],
        ),
      ],
    );
  }
}

/// Tải dữ liệu bất đồng bộ + kéo để làm mới + tự làm mới định kỳ (tùy chọn).
class AsyncView<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload)
      builder;
  final Duration? autoRefresh;
  const AsyncView(
      {super.key, required this.load, required this.builder, this.autoRefresh});
  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
  T? _data;
  bool _has = false;
  Object? _error;
  bool _loading = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _reload();
    if (widget.autoRefresh != null) {
      _timer = Timer.periodic(widget.autoRefresh!, (_) => _reload(silent: true));
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _reload({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final d = await widget.load();
      if (!mounted) return;
      setState(() {
        _data = d;
        _has = true;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (!silent || !_has) _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && !_has) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && !_has) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('😕', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 8),
              Text(_error.toString(), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _reload, child: const Text('Thử lại')),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _reload(silent: true),
      child: widget.builder(context, _data as T, _reload),
    );
  }
}

/// Khối rỗng có biểu tượng.
class EmptyBox extends StatelessWidget {
  final String icon, text;
  final Widget? action;
  const EmptyBox(this.icon, this.text, {super.key, this.action});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 44)),
            const SizedBox(height: 8),
            Text(text, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 12), action!],
          ],
        ),
      );
}
