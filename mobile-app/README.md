# Nấm Smart – app khách hàng (Flutter)

App khách hàng của đề tài (gói công việc 3), gọi REST API của `backend/` (xem `backend/API.md`).

Chức năng: đăng nhập / đăng ký · khay của tôi (môi trường, biểu đồ, nhật ký) · nhập mã khay · thuê khay · gia hạn đơn thuê ·
thu hoạch & giao nhận · thông báo · tài khoản.

## Cài đặt (làm một lần)

1. Cài Flutter SDK: https://docs.flutter.dev/get-started/install, kiểm tra bằng `flutter doctor`.
   Muốn chạy trên Android thì cài thêm Android Studio (để có Android SDK và máy ảo).
2. Trong thư mục `mobile-app/` chạy:

```
flutter pub get
```

Thư mục `android/`, `web/` và cấu hình Android (quyền Internet, cho phép HTTP) đã có sẵn trong repo, không cần `flutter create`.

## Chạy

1. Chạy backend (`backend/`, `npm start`, cổng 3000) với database đã tạo bằng `database\run_all.ps1`.
2. Chạy app:
   - Trình duyệt: `flutter run -d chrome` (hoặc `flutter build web` rồi phục vụ thư mục `build/web`).
   - Máy ảo Android: `flutter run` (chọn thiết bị).
3. Đăng nhập tài khoản khách mẫu, ví dụ `an.le@example.test` / `Mushroom@123`.

Địa chỉ API mặc định: máy ảo Android `http://10.0.2.2:3000/api`, các nền tảng khác `http://localhost:3000/api`.
Điện thoại thật: ở màn hình đăng nhập mở "Cài đặt kết nối máy chủ", nhập `http://<IP máy chạy backend>:3000/api`
(cùng Wi-Fi; tường lửa Windows phải cho phép cổng 3000).

## Build file APK (cài lên điện thoại Android)

Cần thêm (ngoài Flutter): **JDK 17** và **Android SDK** có `platform-tools`, `platforms/android-36`, `build-tools/36.0.0`
(cài bằng Android Studio, hoặc Android command-line tools: `android sdk install platform-tools platforms/android-36 build-tools/36.0.0`).
Khi cài Android SDK phải đồng ý điều khoản Android SDK của Google. Trỏ Flutter tới JDK và SDK:

```
flutter config --android-sdk <thư mục Android SDK> --jdk-dir <thư mục JDK 17>
flutter doctor
```

`flutter doctor` phải báo `[√] Android toolchain`. Sau đó trong `mobile-app/`:

```
flutter build apk --release
```

File APK nằm ở `build/app/outputs/flutter-apk/app-release.apk` (không commit file này lên repo).
Bản này ký bằng khoá debug: cài thử / demo được, chưa đưa lên Google Play.

**Cài lên điện thoại:**

1. Chép `app-release.apk` sang điện thoại (cáp USB, Zalo, Google Drive…) rồi mở file.
2. Cho phép "Cài ứng dụng không rõ nguồn gốc" cho ứng dụng dùng để mở file khi Android hỏi, rồi cài.
3. Điện thoại và máy chạy backend **cùng Wi-Fi**. Mở app → "Cài đặt kết nối máy chủ" → nhập `http://<IP máy chạy backend>:3000/api`
   (xem IP bằng `ipconfig`, mục Wi-Fi → IPv4). Tường lửa Windows phải cho phép Node.js nhận kết nối.

## Kiểm tra

```
flutter analyze
flutter build web
```

## Quy ước dữ liệu từ API

- **Ngày** (`StartDate`, `EndDate`, `ScheduledDate`, `ExpectedHarvestDate`…): chuỗi `YYYY-MM-DD`, hiển thị thẳng.
- **Thời điểm** (`CreatedAt`, `PaidAt`, `RecordedAt`, `LoggedAt`…): ISO có `Z` (UTC), đổi sang giờ máy trước khi hiển thị.
  Cả hai được xử lý trong `parseTime()` ở `lib/util.dart`.
- Lỗi nghiệp vụ: hiện thẳng `error.message` của backend (ví dụ `DB_50009` khi gói thuê quá ngắn so với loại nấm).
- Camera chỉ ở mức tham khảo: nút "Xem camera trực tiếp" mở URL camera đã cấu hình, dữ liệu mẫu là link giả.
