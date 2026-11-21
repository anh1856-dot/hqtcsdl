import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

Map<String, dynamic> asMap(dynamic x) =>
    x is Map ? Map<String, dynamic>.from(x) : <String, dynamic>{};
List<dynamic> asList(dynamic x) => x is List ? x : <dynamic>[];

/// Gọi REST API của backend/ (xem backend/API.md): { data, pagination, unreadCount }.
class Api {
  Api._();
  static final Api i = Api._();

  late SharedPreferences _prefs;
  String baseUrl = defaultBaseUrl();
  String token = '';
  Map<String, dynamic> user = {};

  /// Số thông báo chưa đọc (dùng cho huy hiệu trên tab).
  final ValueNotifier<int> unread = ValueNotifier<int>(0);

  /// Được gọi khi máy chủ trả 401 (hết phiên).
  VoidCallback? onUnauthorized;

  /// Giả lập Android dùng 10.0.2.2 để trỏ tới máy tính đang chạy backend.
  static String defaultBaseUrl() {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    baseUrl = _prefs.getString('api') ?? baseUrl;
    token = _prefs.getString('token') ?? '';
  }

  Future<void> setBaseUrl(String v) async {
    baseUrl = v.trim().replaceAll(RegExp(r'/+$'), '');
    await _prefs.setString('api', baseUrl);
  }

  Future<void> saveToken(String t) async {
    token = t;
    await _prefs.setString('token', t);
  }

  Future<void> clearSession() async {
    token = '';
    user = {};
    unread.value = 0;
    await _prefs.remove('token');
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final req = http.Request(method, Uri.parse(baseUrl + path));
    req.headers['Content-Type'] = 'application/json';
    if (auth && token.isNotEmpty) req.headers['Authorization'] = 'Bearer $token';
    if (body != null) req.body = jsonEncode(body);

    http.Response res;
    try {
      final streamed = await req.send().timeout(const Duration(seconds: 15));
      res = await http.Response.fromStream(streamed);
    } catch (_) {
      throw ApiException(
          'Không kết nối được máy chủ. Hãy chạy backend (npm run dev) và kiểm tra địa chỉ API.');
    }

    Map<String, dynamic> parsed = {};
    try {
      final d = jsonDecode(utf8.decode(res.bodyBytes));
      if (d is Map) parsed = Map<String, dynamic>.from(d);
    } catch (_) {}

    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (res.statusCode == 401 && auth) {
        await clearSession();
        onUnauthorized?.call();
      }
      final msg = asMap(parsed['error'])['message'];
      throw ApiException(
          msg is String ? msg : 'Lỗi máy chủ (${res.statusCode}).', res.statusCode);
    }
    return parsed;
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) =>
      request('GET', path, auth: auth);
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body,
          {bool auth = true}) =>
      request('POST', path, body: body, auth: auth);
  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      request('PUT', path, body: body);
  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) =>
      request('PATCH', path, body: body);
  Future<Map<String, dynamic>> delete(String path) => request('DELETE', path);

  /// GET nhưng lỗi thì trả { data: [] } (cho dữ liệu phụ như môi trường, tùy chọn thông báo).
  Future<Map<String, dynamic>> getSafe(String path) async {
    try {
      return await get(path);
    } catch (_) {
      return {'data': <dynamic>[]};
    }
  }

  Future<void> refreshUnread() async {
    try {
      final r = await get('/notifications?unreadOnly=true&pageSize=1');
      final n = r['unreadCount'];
      unread.value = n is num ? n.toInt() : 0;
    } catch (_) {}
  }
}
