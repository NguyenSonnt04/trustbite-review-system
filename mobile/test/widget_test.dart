import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';

void main() {
  testWidgets('shows the separate TrustBite login entry screen',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Đăng ký'), findsOneWidget);
    expect(find.text('Số điện thoại'), findsOneWidget);
    expect(
        find.text('Nhập số điện thoại để nhận mã đăng nhập.'), findsOneWidget);
    expect(find.text('Tiếp tục với Google'), findsOneWidget);

    await tester.tap(find.text('Đăng ký'));
    await tester.pumpAndSettle();

    expect(find.text('Tạo tài khoản mới bằng số điện thoại của bạn.'),
        findsOneWidget);
  });
}
