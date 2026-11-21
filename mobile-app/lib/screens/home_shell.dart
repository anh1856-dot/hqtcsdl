import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import 'harvest_screen.dart';
import 'me_screen.dart';
import 'notif_screen.dart';
import 'rent_screen.dart';
import 'trays_screen.dart';

class HomeShell extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeShell({super.key, required this.onLogout});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  Timer? _timer;

  static const _titles = [
    'Khay của tôi',
    'Thuê khay',
    'Thu hoạch & giao nhận',
    'Thông báo',
    'Tài khoản',
  ];

  @override
  void initState() {
    super.initState();
    Api.i.refreshUnread();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => Api.i.refreshUnread());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Widget _page() {
    switch (_tab) {
      case 0:
        return TraysScreen(onGoRent: () => setState(() => _tab = 1));
      case 1:
        return RentScreen(onRented: () => setState(() => _tab = 0));
      case 2:
        return const HarvestScreen();
      case 3:
        return const NotifScreen();
      default:
        return MeScreen(onLogout: widget.onLogout);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_tab])),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: KeyedSubtree(key: ValueKey<int>(_tab), child: _page()),
        ),
      ),
      bottomNavigationBar: ValueListenableBuilder<int>(
        valueListenable: Api.i.unread,
        builder: (context, unread, _) => NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: [
            const NavigationDestination(icon: Icon(Icons.grass), label: 'Khay'),
            const NavigationDestination(icon: Icon(Icons.add_shopping_cart), label: 'Thuê'),
            const NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'Thu hoạch'),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text(unread > 99 ? '99+' : '$unread'),
                child: const Icon(Icons.notifications_outlined),
              ),
              label: 'Thông báo',
            ),
            const NavigationDestination(icon: Icon(Icons.person_outline), label: 'Tôi'),
          ],
        ),
      ),
    );
  }
}
