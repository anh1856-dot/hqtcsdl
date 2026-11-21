import 'package:flutter/material.dart';

import '../api.dart';
import '../util.dart';

class HarvestScreen extends StatelessWidget {
  const HarvestScreen({super.key});

  Future<void> _deliverDialog(
      BuildContext context, Map<String, dynamic> h, Future<void> Function() reload) async {
    final user = Api.i.user;
    final addr = TextEditingController(text: (user['Address'] ?? '').toString());
    final phone = TextEditingController(text: (user['Phone'] ?? '').toString());
    String type = 'Pickup';
    DateTime? date;
    String? err;
    bool busy = false;

    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(builder: (c, setS) {
        return AlertDialog(
          title: Text('Nhận nấm khay ${h['TrayCode']}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Khối lượng ${fmtNum(h['WeightKg'], 2)} kg.',
                    style: const TextStyle(color: Colors.black54)),
                if (err != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(err!, style: TextStyle(color: Colors.red.shade700)),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Nhận tại trại'),
                      selected: type == 'Pickup',
                      onSelected: (_) => setS(() => type = 'Pickup'),
                    ),
                    ChoiceChip(
                      label: const Text('Giao tận nơi (+30.000đ)'),
                      selected: type == 'Delivery',
                      onSelected: (_) => setS(() => type = 'Delivery'),
                    ),
                  ],
                ),
                if (type == 'Delivery') ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: addr,
                    decoration: const InputDecoration(
                        labelText: 'Địa chỉ giao (trống = dùng địa chỉ hồ sơ)'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: phone,
                    keyboardType: TextInputType.phone,
                    decoration:
                        const InputDecoration(labelText: 'Số điện thoại người nhận'),
                  ),
                ],
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text(date == null ? 'Ngày mong muốn' : fmtDate(isoDate(date!))),
                  onPressed: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(
                      context: c,
                      initialDate: now,
                      firstDate: now,
                      lastDate: now.add(const Duration(days: 365)),
                    );
                    if (d != null) setS(() => date = d);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      setS(() => busy = true);
                      final body = <String, dynamic>{
                        'harvestId': toI(h['HarvestId']),
                        'requestType': type,
                      };
                      if (date != null) body['preferredDate'] = isoDate(date!);
                      if (type == 'Delivery') {
                        if (addr.text.trim().isNotEmpty) body['address'] = addr.text.trim();
                        if (phone.text.trim().isNotEmpty) {
                          body['receiverPhone'] = phone.text.trim();
                        }
                      }
                      try {
                        await Api.i.post('/deliveries', body);
                        if (c.mounted) Navigator.pop(c, true);
                      } catch (e) {
                        setS(() {
                          err = e.toString();
                          busy = false;
                        });
                      }
                    },
              child: const Text('Gửi yêu cầu'),
            ),
          ],
        );
      }),
    );
    if (ok == true) {
      if (context.mounted) toast(context, 'Đã gửi yêu cầu');
      await reload();
    }
  }

  Future<void> _cancel(BuildContext context, dynamic id, Future<void> Function() reload) async {
    final ok = await confirmBox(context, 'Hủy yêu cầu',
        'Bạn chắc chắn muốn hủy yêu cầu nhận / giao nấm này?', 'Hủy yêu cầu');
    if (!ok) return;
    try {
      await Api.i.patch('/deliveries/$id/cancel');
      if (context.mounted) toast(context, 'Đã hủy yêu cầu');
      await reload();
    } catch (e) {
      if (context.mounted) toast(context, e.toString(), err: true);
    }
  }

  Widget _card(BuildContext context, Map<String, dynamic> h, Future<void> Function() reload) {
    final done = h['Status'] == 'Completed';
    final hasReq = h['DeliveryRequestId'] != null &&
        h['DeliveryStatus'] != null &&
        h['DeliveryStatus'] != 'Cancelled';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text('${h['TrayCode']} · ${h['TypeName'] ?? 'Nấm'}',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                Pill(vi(harvestVi, h['Status']), color: done ? kGreen : Colors.grey),
              ],
            ),
            if (done)
              Text(
                  'Thu ngày ${fmtDate(h['HarvestedAt'])} · ${fmtNum(h['WeightKg'], 2)} kg · loại ${h['Quality'] ?? '–'}')
            else
              Text('Dự kiến ${fmtDate(h['ScheduledDate'])}',
                  style: const TextStyle(color: Colors.black54)),
            if (done && !hasReq)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: FilledButton.tonal(
                  onPressed: () => _deliverDialog(context, h, reload),
                  child: const Text('Nhận nấm / giao tận nơi'),
                ),
              ),
            if (hasReq) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                children: [
                  Pill(h['RequestType'] == 'Pickup' ? 'Nhận tại trại' : 'Giao tận nơi',
                      color: Colors.blue.shade700),
                  Pill(vi(deliveryVi, h['DeliveryStatus']),
                      color: h['DeliveryStatus'] == 'Completed'
                          ? kGreen
                          : Colors.orange.shade800),
                ],
              ),
              if (h['DeliveryStatus'] == 'Pending')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
                    onPressed: () => _cancel(context, h['DeliveryRequestId'], reload),
                    child: const Text('Hủy yêu cầu'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<dynamic>>(
      load: () async => asList((await Api.i.get('/my/harvests'))['data']),
      builder: (context, raw, reload) {
        final list = raw.map(asMap).toList();
        if (list.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              EmptyBox('🧺',
                  'Chưa có đợt thu hoạch nào.\nKhi nấm đến hạn, lịch thu hoạch sẽ hiện ở đây.'),
            ],
          );
        }
        final done = list.where((h) => h['Status'] == 'Completed').toList();
        final sched = list.where((h) => h['Status'] == 'Scheduled').toList();
        final kg = done.fold<double>(0, (s, h) => s + (toD(h['WeightKg']) ?? 0));
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Tổng sản lượng đã thu',
                            style: TextStyle(fontSize: 12, color: Colors.black54)),
                        Text('${kg.toStringAsFixed(2)} kg',
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 20, color: kGreen)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Số đợt',
                            style: TextStyle(fontSize: 12, color: Colors.black54)),
                        Text('${done.length}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 20, color: kGreen)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (sched.isNotEmpty) ...[
              const SectionTitle('Sắp thu hoạch'),
              for (final h in sched) _card(context, h, reload),
            ],
            if (done.isNotEmpty) ...[
              const SectionTitle('Đã thu hoạch'),
              for (final h in done) _card(context, h, reload),
            ],
          ],
        );
      },
    );
  }
}
