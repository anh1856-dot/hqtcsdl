import 'package:flutter/material.dart';

import '../api.dart';
import '../util.dart';

class RentScreen extends StatefulWidget {
  final VoidCallback onRented;
  const RentScreen({super.key, required this.onRented});
  @override
  State<RentScreen> createState() => _RentScreenState();
}

class _RentScreenState extends State<RentScreen> {
  String? _packageId;
  int _count = 1;
  int _combo = -1; // -1 = tự động chọn
  String _method = 'EWallet';
  bool _busy = false;

  Future<Map<String, dynamic>> _load() async {
    final results = await Future.wait([
      Api.i.get('/packages', auth: false),
      Api.i.get('/trays/available'),
      Api.i.get('/rentals?pageSize=20'),
    ]);
    return {
      'pkgs': asList(results[0]['data']),
      'avail': asList(results[1]['data']),
      'rentals': asList(results[2]['data']),
    };
  }

  Future<void> _submit(Map<String, dynamic> pkg, Map<String, dynamic>? combo) async {
    final total = toD(pkg['PricePerTray'])! * _count;
    final ok = await confirmBox(
      context,
      'Xác nhận thuê khay',
      'Gói ${pkg['PackageName']} · $_count khay\n'
          'Thời hạn ${pkg['DurationDays']} ngày\n'
          'Thanh toán ${vi(payVi, _method)}: ${fmtMoney(total)}',
      'Thanh toán',
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{
        'packageId': pkg['PackageId'],
        'trayCount': _count,
        'paymentMethod': _method,
      };
      if (combo != null) {
        body['roomId'] = combo['RoomId'];
        if (combo['MushroomTypeId'] != null) body['mushroomTypeId'] = combo['MushroomTypeId'];
      }
      final res = await Api.i.post('/rentals', body);
      final codes = asList(asMap(res['data'])['trays'])
          .map((x) => asMap(x)['TrayCode'])
          .where((x) => x != null)
          .join(', ');
      if (!mounted) return;
      toast(context, 'Thuê thành công${codes.isNotEmpty ? ': $codes' : ''}!');
      Api.i.refreshUnread();
      widget.onRented();
    } catch (e) {
      if (mounted) toast(context, e.toString(), err: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      load: _load,
      builder: (context, data, reload) {
        final pkgs = asList(data['pkgs']).map(asMap).toList();
        final avail = asList(data['avail']).map(asMap).toList();
        final rentals = asList(data['rentals']).map(asMap).toList();

        if (!pkgs.any((p) => p['PackageId'].toString() == _packageId)) {
          _packageId = pkgs.isNotEmpty ? pkgs.first['PackageId'].toString() : null;
          _count = 1;
        }
        if (_combo >= avail.length) _combo = -1;

        Map<String, dynamic>? pkg;
        for (final p in pkgs) {
          if (p['PackageId'].toString() == _packageId) pkg = p;
        }
        final combo = _combo >= 0 ? avail[_combo] : null;
        final totalAvail = avail.fold<int>(0, (s, a) => s + toI(a['AvailableTrays']));
        var maxCount = 0;
        if (pkg != null) {
          final cap = combo != null ? toI(combo['AvailableTrays']) : totalAvail;
          maxCount = toI(pkg['MaxTrays']) < cap ? toI(pkg['MaxTrays']) : cap;
          if (maxCount < 0) maxCount = 0;
          if (_count > maxCount) _count = maxCount < 1 ? 1 : maxCount;
          if (_count < 1) _count = 1;
        }

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          children: [
            const SectionTitle('Chọn gói thuê'),
            if (pkgs.isEmpty) const EmptyBox('📦', 'Hiện chưa có gói thuê nào.'),
            for (final p in pkgs)
              Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: p['PackageId'].toString() == _packageId
                        ? kGreen
                        : const Color(0xFFE6E2D6),
                    width: p['PackageId'].toString() == _packageId ? 2 : 1,
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => setState(() {
                    _packageId = p['PackageId'].toString();
                    _count = 1;
                  }),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(p['PackageName'].toString(),
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text('${fmtMoney(p['PricePerTray'])} /khay',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, color: kGreen)),
                          ],
                        ),
                        Text(
                            '${p['DurationDays']} ngày · tối đa ${p['MaxTrays']} khay/đơn',
                            style: const TextStyle(fontSize: 13, color: Colors.black54)),
                        if (p['Description'] != null &&
                            p['Description'].toString().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(p['Description'].toString(),
                                style: const TextStyle(fontSize: 13)),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            if (pkg != null) ...[
              const SectionTitle('Thông tin thuê'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<int>(
                        value: _combo,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'Phòng / loại nấm'),
                        items: [
                          DropdownMenuItem(
                              value: -1,
                              child: Text('Tự động chọn (còn $totalAvail khay trống)')),
                          for (var i = 0; i < avail.length; i++)
                            DropdownMenuItem(
                              value: i,
                              child: Text(
                                '${avail[i]['RoomName']} – ${avail[i]['TypeName'] ?? 'Chưa chọn loại'} (còn ${avail[i]['AvailableTrays']})',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (v) => setState(() {
                          _combo = v ?? -1;
                          _count = 1;
                        }),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Số khay'),
                          Row(
                            children: [
                              IconButton.outlined(
                                onPressed: _count > 1 ? () => setState(() => _count--) : null,
                                icon: const Icon(Icons.remove),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text('$_count',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800, fontSize: 16)),
                              ),
                              IconButton.outlined(
                                onPressed:
                                    _count < maxCount ? () => setState(() => _count++) : null,
                                icon: const Icon(Icons.add),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text('Tối đa $maxCount khay',
                            style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      ),
                      const SizedBox(height: 8),
                      const Text('Thanh toán',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final k in payVi.keys.where((k) => k != 'Cash'))
                            ChoiceChip(
                              label: Text(payVi[k]!),
                              selected: _method == k,
                              onSelected: (_) => setState(() => _method = k),
                            ),
                        ],
                      ),
                      const Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Tạm tính ($_count × ${fmtMoney(pkg['PricePerTray'])})',
                              style: const TextStyle(color: Colors.black54)),
                          Text(fmtMoney((toD(pkg['PricePerTray']) ?? 0) * _count),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 18, color: kGreen)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      FilledButton(
                        onPressed: (maxCount < 1 || _busy) ? null : () => _submit(pkg!, combo),
                        child: Text(maxCount < 1 ? 'Hết khay trống' : 'Thuê ngay'),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Thanh toán được giả lập, thành công ngay sau khi xác nhận.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SectionTitle('Đơn thuê của tôi'),
            if (rentals.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(14),
                  child: Text('Bạn chưa có đơn thuê nào.',
                      style: TextStyle(color: Colors.black54)),
                ),
              )
            else
              for (final x in rentals)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text('Đơn #${x['RentalId']} · ${x['PackageName']}',
                                  style: const TextStyle(fontWeight: FontWeight.w700)),
                            ),
                            Pill(vi(rentalVi, x['Status']),
                                color: x['Status'] == 'Active' ? kGreen : Colors.grey),
                          ],
                        ),
                        Text(
                            '${fmtDate(x['StartDate'])} → ${fmtDate(x['EndDate'])} · ${x['TrayCount']} khay · ${fmtMoney(x['TotalAmount'])}',
                            style: const TextStyle(fontSize: 13, color: Colors.black54)),
                        if (x['TrayCodes'] != null && x['TrayCodes'].toString().isNotEmpty)
                          Text('Khay: ${x['TrayCodes']}', style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ),
          ],
        );
      },
    );
  }
}
