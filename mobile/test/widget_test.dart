import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';
import 'package:trustbite_mobile/src/features/launch/brand_launch_screen.dart';

void main() {
  testWidgets('shows branded launch screen before handing off', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: BrandLaunchScreen(
          duration: Duration(milliseconds: 10),
          child: Text('Home ready'),
        ),
      ),
    );

    expect(find.byKey(const ValueKey('brand-launch-view')), findsOneWidget);
    expect(find.text('Review thật, ăn yên tâm.'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 260));

    expect(find.text('Home ready'), findsOneWidget);
  });

  testWidgets('opens login screen from the guest home header', (tester) async {
    final authService = _FakeMobileAuthService();
    final cognitoGateway = _FakeCognitoAuthGateway();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: authService,
          cognitoAuthGateway: cognitoGateway,
        ),
      ),
    );

    expect(find.text('Trust 0'), findsOneWidget);

    await tester.tap(find.text('Trust 0'));
    await tester.pumpAndSettle();

    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Tiếp tục'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'reviewer@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '123456',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(find.text('Email'), findsNothing);
    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
    expect(cognitoGateway.lastIdentifier, 'reviewer@example.com');
    expect(cognitoGateway.requestOtpCalls, 1);
    expect(authService.cognitoSignInCalls, 1);
    expect(authService.localDevelopmentSignUpCalls, 0);
  });

  testWidgets('shows login prompt on the profile tab for guests', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(authService: _FakeMobileAuthService())),
    );

    await tester.tap(find.text('Tôi'));
    await tester.pumpAndSettle();

    expect(find.text('Bạn chưa đăng nhập'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('signs out from the profile tab and returns to guest state', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService();
    final cognitoGateway = _FakeCognitoAuthGateway();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: authService,
          cognitoAuthGateway: cognitoGateway,
        ),
      ),
    );

    await tester.tap(find.text('Trust 0'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'reviewer@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '123456',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Local Test User'), findsOneWidget);
    expect(find.text('Đăng xuất'), findsOneWidget);

    await tester.ensureVisible(find.text('Đăng xuất'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đăng xuất'));
    await tester.pumpAndSettle();

    expect(authService.signOutCalls, 1);
    expect(find.text('Đã đăng xuất.'), findsOneWidget);
    expect(find.text('Bạn chưa đăng nhập'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('shows the polished favorites empty state and suggestions', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(authService: _FakeMobileAuthService())),
    );

    await tester.tap(find.text('Yêu thích'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('favorites-page')), findsOneWidget);
    expect(find.text('Chưa có quán yêu thích'), findsOneWidget);
    expect(find.text('Gợi ý để lưu'), findsOneWidget);
    expect(find.text('Phở Thìn Bờ Hồ'), findsOneWidget);
    expect(find.text('Có review xác thực'), findsWidgets);
  });

  testWidgets('opens the mock notifications page from the home header', (
    tester,
  ) async {
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

  testWidgets('shows the separate TrustBite login entry screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          authService: _FakeMobileAuthService(),
          cognitoAuthGateway: _FakeCognitoAuthGateway(),
        ),
      ),
    );

    expect(find.text('Đăng ký'), findsNothing);
    expect(find.text('Email'), findsOneWidget);
    expect(
      find.text('Nhập email để nhận mã xác thực tài khoản.'),
      findsOneWidget,
    );
    expect(find.text('Tiếp tục'), findsOneWidget);
    expect(find.text('Tiếp tục với Google'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'signup@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '123456',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
  });

  testWidgets('completes an OTP challenge before loading the user', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService();
    final cognitoGateway = _FakeCognitoAuthGateway(
      results: const [
        CognitoAuthResult(CognitoAuthStep.confirmSmsMfa),
        CognitoAuthResult.signedIn(),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          authService: authService,
          cognitoAuthGateway: cognitoGateway,
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'reviewer@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.text('Nhập mã MFA được gửi qua SMS.'), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '123456',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(cognitoGateway.lastConfirmationValue, '123456');
    expect(authService.cognitoSignInCalls, 1);
    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
  });

  testWidgets('shows Cognito signup confirmation challenge when required', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService();
    final cognitoGateway = _FakeCognitoAuthGateway(
      results: const [
        CognitoAuthResult(CognitoAuthStep.confirmSignUp),
        CognitoAuthResult.signedIn(),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          authService: authService,
          cognitoAuthGateway: cognitoGateway,
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'new-user@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();

    expect(
      find.text('Nhập mã xác thực đã gửi để xác nhận tài khoản.'),
      findsOneWidget,
    );
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '654321',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(cognitoGateway.lastConfirmationValue, '654321');
    expect(authService.cognitoSignInCalls, 1);
  });
}

class _FakeMobileAuthService implements MobileAuthService {
  int cognitoSignInCalls = 0;
  int localDevelopmentSignUpCalls = 0;
  int signOutCalls = 0;

  @override
  Future<Map<String, dynamic>> completeCognitoSignIn() async {
    cognitoSignInCalls += 1;
    return {'displayName': 'Local Test User'};
  }

  @override
  Future<Map<String, dynamic>> completeLocalDevelopmentSignUp({
    required String phoneNumber,
    String? displayName,
  }) async {
    localDevelopmentSignUpCalls += 1;
    return {'displayName': 'Local Test User'};
  }

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
  }
}

class _FakeCognitoAuthGateway implements CognitoAuthGateway {
  _FakeCognitoAuthGateway({
    List<CognitoAuthResult> results = const [
      CognitoAuthResult(CognitoAuthStep.confirmOtp),
      CognitoAuthResult.signedIn(),
    ],
  }) : _results = List.of(results);

  final List<CognitoAuthResult> _results;
  String? lastIdentifier;
  String? lastConfirmationValue;
  int requestOtpCalls = 0;

  @override
  Future<CognitoAuthResult> requestOtp({required String identifier}) async {
    lastIdentifier = identifier;
    requestOtpCalls += 1;
    return _results.removeAt(0);
  }

  @override
  Future<CognitoAuthResult> confirmOtp(String confirmationValue) async {
    lastConfirmationValue = confirmationValue;
    return _results.removeAt(0);
  }

  @override
  Future<String?> getAccessToken() async => 'cognito-access-token';

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> isSignedIn() async => false;

  @override
  Future<void> signOut() async {}
}
