import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';

void main() {
  testWidgets('shows the separate TrustBite login entry screen', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Đăng ký'), findsOneWidget);
    expect(find.text('SĐT'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Tiếp tục với Google'), findsOneWidget);
  });
}
