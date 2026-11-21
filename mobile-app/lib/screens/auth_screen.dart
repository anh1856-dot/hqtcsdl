import 'package:flutter/material.dart';

import '../api.dart';
import '../util.dart';

class AuthScreen extends StatefulWidget {
  final String? notice;
  final VoidCallback onLoggedIn;
  const AuthScreen({super.key, this.notice, required this.onLoggedIn});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _phone = TextEditingController();
  final _addr = TextEditingController();
  final _apiCtl = TextEditingController(text: Api.i.baseUrl);
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _phone.dispose();
    _addr.dispose();
    _apiCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      Map<String, dynamic> r;
      if (_register) {
        final body = <String, dynamic>{
          'fullName': _name.text.trim(),
          'email': _email.text.trim(),
          'password': _pass.text,
        };
        if (_phone.text.trim().isNotEmpty) body['phone'] = _phone.text.trim();
        if (_addr.text.trim().isNotEmpty) body['address'] = _addr.text.trim();
        r = await Api.i.post('/auth/register', body, auth: false);
      } else {
        r = await Api.i.post(
            '/auth/login', {'email': _email.text.trim(), 'password': _pass.text},
            auth: false);
      }
      final data = asMap(r['data']);
      final user = asMap(data['user']);
      if (user['Role'] != 'Customer') {
        throw ApiException(
            'Ứng dụng này dành cho khách hàng. Tài khoản quản trị vui lòng dùng web quản lý.');
      }
      await Api.i.saveToken(data['token'].toString());
      Api.i.user = user;
      widget.onLoggedIn();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final err = _error ?? widget.notice;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: [
                  const Text('🍄', style: TextStyle(fontSize: 56)),
                  const Text('Nấm Smart',
                      style: TextStyle(
                          fontSize: 26, fontWeight: FontWeight.w800, color: kGreen)),
                  const Text('Thuê khay – theo dõi nấm của bạn từ xa',
                      style: TextStyle(color: Colors.black54)),
                  const SizedBox(height: 18),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Form(
                        key: _form,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(_register ? 'Tạo tài khoản' : 'Đăng nhập',
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w700)),
                            if (err != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(err,
                                    style: TextStyle(color: Colors.red.shade700)),
                              ),
                            const SizedBox(height: 12),
                            if (_register) ...[
                              TextFormField(
                                controller: _name,
                                decoration: const InputDecoration(labelText: 'Họ và tên'),
                                validator: (v) => (v == null || v.trim().isEmpty)
                                    ? 'Vui lòng nhập họ tên'
                                    : null,
                              ),
                              const SizedBox(height: 10),
                            ],
                            TextFormField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(labelText: 'Email'),
                              validator: (v) => (v == null || !v.contains('@'))
                                  ? 'Email không hợp lệ'
                                  : null,
                            ),
                            const SizedBox(height: 10),
                            TextFormField(
                              controller: _pass,
                              obscureText: true,
                              decoration: InputDecoration(
                                  labelText:
                                      'Mật khẩu${_register ? ' (tối thiểu 6 ký tự)' : ''}'),
                              validator: (v) => (v == null || v.isEmpty)
                                  ? 'Vui lòng nhập mật khẩu'
                                  : (_register && v.length < 6)
                                      ? 'Tối thiểu 6 ký tự'
                                      : null,
                            ),
                            if (_register) ...[
                              const SizedBox(height: 10),
                              TextFormField(
                                controller: _phone,
                                keyboardType: TextInputType.phone,
                                decoration: const InputDecoration(
                                    labelText: 'Số điện thoại (không bắt buộc)'),
                              ),
                              const SizedBox(height: 10),
                              TextFormField(
                                controller: _addr,
                                decoration: const InputDecoration(
                                    labelText: 'Địa chỉ (không bắt buộc)'),
                              ),
                            ],
                            const SizedBox(height: 14),
                            FilledButton(
                              onPressed: _busy ? null : _submit,
                              child: _busy
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2))
                                  : Text(_register ? 'Đăng ký' : 'Đăng nhập'),
                            ),
                            TextButton(
                              onPressed: () => setState(() {
                                _register = !_register;
                                _error = null;
                              }),
                              child: Text(_register
                                  ? 'Đã có tài khoản? Đăng nhập'
                                  : 'Chưa có tài khoản? Đăng ký'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  ExpansionTile(
                    title: const Text('Cài đặt kết nối máy chủ'),
                    childrenPadding: const EdgeInsets.all(8),
                    children: [
                      TextField(
                        controller: _apiCtl,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(labelText: 'Địa chỉ API'),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton(
                          onPressed: () async {
                            final v = _apiCtl.text.trim();
                            if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(v)) {
                              toast(context, 'Địa chỉ phải bắt đầu bằng http:// hoặc https://',
                                  err: true);
                              return;
                            }
                            await Api.i.setBaseUrl(v);
                            if (context.mounted) toast(context, 'Đã lưu địa chỉ API');
                          },
                          child: const Text('Lưu địa chỉ'),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Giả lập Android: http://10.0.2.2:3000/api · Điện thoại thật: '
                        'http://<IP máy tính>:3000/api (cùng Wi-Fi).',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
