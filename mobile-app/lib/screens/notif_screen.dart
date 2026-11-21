import 'package:flutter/material.dart';

import '../api.dart';
import '../util.dart';
import 'trays_screen.dart';

class NotifScreen extends StatelessWidget {
  const NotifScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      load: () async {
        final results = await Future.wait([
          Api.i.get('/notifications?pageSize=50'),
          Api.i.getSafe('/notifications/preferences'),
        ]);
        final n = results[0];
        Api.i.unread.value = toI(n['unreadCount']);
        return {
          'list': asList(n['data']),
          'unread': toI(n['unreadCount']),
          'prefs': asList(results[1]['data']),
        };
      },
      builder: (context, data, reload) {
        final list = asList(data['list']).map(asMap).toList();
        final unread = toI(data['unread']);
        final prefs = asList(data['prefs']).map(asMap).toList();

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Gần đây', style: TextStyle(fontWeight: FontWeight.w700)),
                if (unread > 0)
                  OutlinedButton(
                    onPressed: () async {
                      try {
                        await Api.i.patch('/notifications/read-all');
                        await reload();
                      } catch (e) {
                        if (context.mounted) toast(context, e.toString(), err: true);
                      }
                    },
                    child: Text('Đọc tất cả ($unread)'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (list.isEmpty) const EmptyBox('🔔', 'Chưa có thông báo nào.'),
            for (final x in list)
              Card(
                color: x['IsRead'] == true || x['IsRead'] == 1
                    ? null
                    : const Color(0xFFEAF5EC),
                child: ListTile(
                  leading: Text(notifIcon[x['Type']] ?? '📢',
                      style: const TextStyle(fontSize: 24)),
                  title: Text(x['Title']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(
                      '${x['Content'] ?? ''}\n${fmtDateTime(x['CreatedAt'])}'),
                  isThreeLine: true,
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () async {
                      try {
                        await Api.i.delete('/notifications/${x['NotificationId']}');
                        await reload();
                      } catch (e) {
                        if (context.mounted) toast(context, e.toString(), err: true);
                      }
                    },
                  ),
                  onTap: () async {
                    final isRead = x['IsRead'] == true || x['IsRead'] == 1;
                    if (!isRead) {
                      try {
                        await Api.i.patch('/notifications/${x['NotificationId']}/read');
                        Api.i.refreshUnread();
                      } catch (_) {}
                    }
                    if (x['TrayId'] != null && context.mounted) {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => TrayDetailScreen(trayId: x['TrayId'].toString())),
                      );
                    }
                    await reload();
                  },
                ),
              ),
            if (prefs.isNotEmpty) ...[
              const SectionTitle('Loại thông báo muốn nhận'),
              Card(
                child: Column(
                  children: [for (final p in prefs) _PrefRow(p)],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _PrefRow extends StatefulWidget {
  final Map<String, dynamic> p;
  const _PrefRow(this.p);
  @override
  State<_PrefRow> createState() => _PrefRowState();
}

class _PrefRowState extends State<_PrefRow> {
  late bool _on;

  @override
  void initState() {
    super.initState();
    final v = widget.p['UserEnabled'];
    _on = v == true || v == 1;
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.p;
    final sysOn = p['SystemEnabled'] == true || p['SystemEnabled'] == 1;
    final name = (p['DisplayName'] ?? notifName[p['Type']] ?? p['Type']).toString();
    return SwitchListTile(
      title: Text(name),
      subtitle: sysOn ? null : const Text('Quản trị viên đã tắt loại này'),
      value: _on,
      onChanged: sysOn
          ? (v) async {
              setState(() => _on = v);
              try {
                await Api.i.put(
                    '/notifications/preferences', {'type': p['Type'], 'isEnabled': v});
                if (context.mounted) toast(context, 'Đã cập nhật');
              } catch (e) {
                if (mounted) setState(() => _on = !v);
                if (context.mounted) toast(context, e.toString(), err: true);
              }
            }
          : null,
    );
  }
}
