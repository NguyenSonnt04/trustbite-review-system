import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';

void main() {
  testWidgets('opens login screen from the guest home header', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(authService: _FakeMobileAuthService())),
    );

    expect(find.text('Trust 0'), findsOneWidget);

    await tester.tap(find.text('Trust 0'));
    await tester.pumpAndSettle();

    expect(find.text('Email hoặc số điện thoại'), findsOneWidget);
    expect(find.text('Tiếp tục với Cognito'), findsOneWidget);

    await tester.tap(find.text('Tiếp tục với Cognito'));
    await tester.pumpAndSettle();

    expect(find.text('Email hoặc số điện thoại'), findsNothing);
    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
  });

  testWidgets('shows login prompt on the profile tab for guests',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(authService: _FakeMobileAuthService())),
    );

    await tester.tap(find.text('Tôi'));
    await tester.pumpAndSettle();

    expect(find.text('Bạn chưa đăng nhập'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('opens the mock notifications page from the home header',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(authService: _FakeMobileAuthService())),
    );

    await tester.tap(find.byIcon(Icons.notifications_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Thông báo'), findsOneWidget);
    expect(find.text('3 mới'), findsOneWidget);
    expect(find.text('Bill đã được xác thực'), findsOneWidget);
    expect(find.text('Có ưu đãi gần bạn'), findsOneWidget);
    expect(find.text('Review được quan tâm'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('notifications-back-button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('notifications-list')), findsNothing);
    expect(find.byIcon(Icons.notifications_rounded), findsOneWidget);
  });

  testWidgets('shows the separate TrustBite login entry screen',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(authService: _FakeMobileAuthService()),
      ),
    );

    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Đăng ký'), findsOneWidget);
    expect(find.text('Email hoặc số điện thoại'), findsOneWidget);
    expect(find.text('Mật khẩu Cognito'), findsOneWidget);
    expect(
      find.text(
          'Đăng nhập bằng Cognito rồi gửi access token tới backend TrustBite.'),
      findsOneWidget,
    );
    expect(find.text('Tiếp tục với Cognito'), findsOneWidget);
    expect(find.text('Tiếp tục với Google'), findsOneWidget);

    await tester.tap(find.text('Đăng ký'));
    await tester.pumpAndSettle();

    expect(
      find.text(
          'Tạo tài khoản qua Cognito; TrustBite chỉ nhận token đã xác thực.'),
      findsOneWidget,
    );
    expect(find.text('Tạo tài khoản Cognito'), findsOneWidget);

    await tester.tap(find.text('Tạo tài khoản Cognito'));
    await tester.pump();

    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
  });
}

class _FakeMobileAuthService implements MobileAuthService {
  @override
  Future<Map<String, dynamic>> completeCognitoSignIn({
    required String accessToken,
  }) async {
    return {'displayName': 'Local Test User'};
  }

  @override
  Future<Map<String, dynamic>> completeLocalDevelopmentSignUp({
    required String phoneNumber,
    String? displayName,
  }) async {
    return {'displayName': 'Local Test User'};
  }

  @override
  Future<void> signOut() async {}
}
