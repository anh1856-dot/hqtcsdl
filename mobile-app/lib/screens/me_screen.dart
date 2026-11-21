import 'package:flutter/material.dart';

import '../api.dart';
import '../util.dart';

class MeScreen extends StatelessWidget {
  final VoidCallback onLogout;
  const MeScreen({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      load: () async {
        final results = await Future.wait([
          Api.i.get('/auth/me'),
          Api.i.getSafe('/my/transactions?pageSize=10'),
        ]);
        final me = asMap(results[0]['data']);
        Api.i.user = me;
        return {'me': me, 'tx': asList(results[1]['data'])};
      },
      builder: (context, data, reload) {
        final u = asMap(data['me']);
        final tx = asList(data['tx']).map(asMap).toList();
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          children: [
            Card(
              child: ListTile(
                leading: const Text('🧑‍🌾', style: TextStyle(fontSize: 34)),
                title: Text(u['FullName']?.toString() ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(u['Email']?.toString() ?? ''),
              ),
            ),
            const SectionTitle('Thông tin cá nhân'),
            _ProfileForm(u),
            const SectionTitle('Đổi mật khẩu'),
            const _PasswordForm(),
            const SectionTitle('Lịch sử thanh toán'),
            if (tx.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(14),
                  child: Text('Chưa có giao dịch.', style: TextStyle(color: Colors.black54)),
                ),
              )
            else
              Card(
                child: Column(
                  children: [
                    for (final p in tx)
                      ListTile(
                        title: Text('${p['PackageName']} · ${p['TrayCount']} khay',
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                            '${fmtDateTime(p['PaidAt'])} · ${vi(payVi, p['Method'])}'),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(fmtMoney(p['Amount']),
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(vi(payStatusVi, p['Status']),
                                style: const TextStyle(fontSize: 12, color: Colors.black54)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
              onPressed: () async {
                if (await confirmBox(context, 'Đăng xuất',
                    'Bạn muốn đăng xuất khỏi tài khoản?', 'Đăng xuất')) {
                  onLogout();
                }
              },
              child: const Text('Đăng xuất'),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text('Máy chủ: ${Api.i.baseUrl}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ),
          ],
        );
      },
    );
  }
}

class _ProfileForm extends StatefulWidget {
  final Map<String, dynamic> u;
  const _ProfileForm(this.u);
  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  late final TextEditingController _name =
      TextEditingController(text: (widget.u['FullName'] ?? '').toString());
  late final TextEditingController _phone =
      TextEditingController(text: (widget.u['Phone'] ?? '').toString());
  late final TextEditingController _addr =
      TextEditingController(text: (widget.u['Address'] ?? '').toString());
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _addr.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      toast(context, 'Vui lòng nhập họ tên', err: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await Api.i.put('/auth/me', {
        'fullName': _name.text.trim(),
        'phone': _phone.text.trim(),
        'address': _addr.text.trim(),
      });
      final d = asMap(r['data']);
      if (d.isNotEmpty) Api.i.user = d;
      if (mounted) toast(context, 'Đã lưu thông tin');
    } catch (e) {
      if (mounted) toast(context, e.toString(), err: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Họ và tên')),
            const SizedBox(height: 10),
            TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Số điện thoại')),
            const SizedBox(height: 10),
            TextField(
                controller: _addr,
                decoration: const InputDecoration(labelText: 'Địa chỉ nhận hàng')),
            const SizedBox(height: 12),
            FilledButton(
                onPressed: _busy ? null : _save, child: const Text('Lưu thay đổi')),
          ],
        ),
      ),
    );
  }
}

class _PasswordForm extends StatefulWidget {
  const _PasswordForm();
  @override
  State<_PasswordForm> createState() => _PasswordFormState();
}

class _PasswordFormState extends State<_PasswordForm> {
  final _cur = TextEditingController();
  final _new = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _cur.dispose();
    _new.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_cur.text.isEmpty || _new.text.length < 6) {
      toast(context, 'Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 6 ký tự).',
          err: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await Api.i.put('/auth/me/password',
          {'currentPassword': _cur.text, 'newPassword': _new.text});
      _cur.clear();
      _new.clear();
      if (mounted) toast(context, 'Đã đổi mật khẩu');
    } catch (e) {
      if (mounted) toast(context, e.toString(), err: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
                controller: _cur,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại')),
            const SizedBox(height: 10),
            TextField(
                controller: _new,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Mật khẩu mới (tối thiểu 6 ký tự)')),
            const SizedBox(height: 12),
            OutlinedButton(
                onPressed: _busy ? null : _save, child: const Text('Đổi mật khẩu')),
          ],
        ),
      ),
    );
  }
}
