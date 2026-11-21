import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';
import 'util.dart';

final GlobalKey<NavigatorState> navKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.i.init();
  runApp(const NamSmartApp());
}

class NamSmartApp extends StatefulWidget {
  const NamSmartApp({super.key});
  @override
  State<NamSmartApp> createState() => _NamSmartAppState();
}

class _NamSmartAppState extends State<NamSmartApp> {
  bool _booting = true;
  bool _loggedIn = false;
  String? _notice;

  @override
  void initState() {
    super.initState();
    Api.i.onUnauthorized = () {
      if (!mounted) return;
      navKey.currentState?.popUntil((r) => r.isFirst);
      setState(() {
        _loggedIn = false;
        _notice = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
      });
    };
    _boot();
  }

  Future<void> _boot() async {
    if (Api.i.token.isNotEmpty) {
      try {
        final me = await Api.i.get('/auth/me');
        final u = asMap(me['data']);
        if (u['Role'] != 'Customer') throw ApiException('Ứng dụng này dành cho khách hàng.');
        Api.i.user = u;
        _loggedIn = true;
      } catch (_) {
        await Api.i.clearSession();
      }
    }
    if (mounted) setState(() => _booting = false);
  }

  Future<void> _logout() async {
    await Api.i.clearSession();
    navKey.currentState?.popUntil((r) => r.isFirst);
    if (mounted) {
      setState(() {
        _loggedIn = false;
        _notice = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget home;
    if (_booting) {
      home = const Scaffold(body: Center(child: CircularProgressIndicator()));
    } else if (_loggedIn) {
      home = HomeShell(onLogout: _logout);
    } else {
      home = AuthScreen(
        notice: _notice,
        onLoggedIn: () => setState(() {
          _loggedIn = true;
          _notice = null;
        }),
      );
    }
    return MaterialApp(
      title: 'Nấm Smart',
      navigatorKey: navKey,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: kGreen),
        scaffoldBackgroundColor: kBg,
        appBarTheme: const AppBarTheme(
          backgroundColor: kGreen,
          foregroundColor: Colors.white,
        ),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          isDense: true,
        ),
      ),
      home: home,
    );
  }
}
