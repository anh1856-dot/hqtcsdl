# Nấm Smart – app khách hàng (Flutter)

Bản viết lại bằng Flutter của app khách hàng (Gói công việc 3 trong đề tài). Gọi REST API của `backend/` (xem `backend/API.md`).

Chức năng: đăng nhập/đăng ký · khay của tôi + môi trường + biểu đồ · thuê khay · thu hoạch & giao nhận · thông báo · tài khoản.

> Lưu ý: mã nguồn này được viết khi chưa có Flutter SDK để biên dịch thử. Nếu `flutter run` báo lỗi, gửi nguyên văn lỗi để sửa.

## Cài đặt (làm một lần)

1. Cài Flutter SDK: https://docs.flutter.dev/get-started/install (kèm Android Studio để có giả lập Android). Kiểm tra bằng `flutter doctor`.
2. Giải nén thư mục này, mở terminal trong `nam_smart_flutter/`, chạy:

```
flutter create --platforms=android,web --project-name nam_smart .
flutter pub get
```

(`flutter create .` chỉ sinh thêm thư mục `android/`, `web/`… và giữ nguyên `lib/`, `pubspec.yaml`.)
Xóa file `test/widget_test.dart` do lệnh trên tạo ra (nó tham chiếu `MyApp`, không dùng).

3. Android cần quyền Internet và cho phép HTTP thường (backend chạy `http://`). Mở `android/app/src/main/AndroidManifest.xml`, thêm trước thẻ `<application`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

và thêm thuộc tính vào thẻ `<application`:

```xml
android:usesCleartextTraffic="true"
```

## Chạy

1. Chạy backend (`backend/`, `npm run dev`, cổng 3000).
2. Chạy app: `flutter run` (chọn giả lập Android hoặc `-d chrome`).

Địa chỉ API mặc định: giả lập Android `http://10.0.2.2:3000/api`, các nền tảng khác `http://localhost:3000/api`. Điện thoại thật: vào "Cài đặt kết nối máy chủ" ở màn hình đăng nhập, nhập `http://<IP máy tính>:3000/api` (cùng Wi-Fi). Chạy trên web (`-d chrome`) cần backend bật CORS.

## Build file cài đặt

`flutter build apk` → `build/app/outputs/flutter-apk/app-release.apk`.

## Cấu trúc

- `lib/main.dart` – khởi động, giao diện, đăng nhập/đăng xuất
- `lib/api.dart` – gọi API, lưu token
- `lib/util.dart` – nhãn tiếng Việt, định dạng, widget dùng chung
- `lib/screens/` – các màn hình (auth, home_shell, trays, rent, harvest, notif, me)
