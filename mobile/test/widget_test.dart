import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';

void main() {
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

    expect(find.text('Email hoặc số điện thoại'), findsOneWidget);
    expect(find.text('Tiếp tục với Cognito'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Email hoặc số điện thoại'),
      'reviewer@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Mật khẩu Cognito'),
      'CorrectHorse1!',
    );
    await tester.tap(find.text('Tiếp tục với Cognito'));
    await tester.pumpAndSettle();

    expect(find.text('Email hoặc số điện thoại'), findsNothing);
    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
    expect(cognitoGateway.lastIdentifier, 'reviewer@example.com');
    expect(cognitoGateway.lastPassword, 'CorrectHorse1!');
    expect(cognitoGateway.signInCalls, 1);
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

    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Đăng ký'), findsOneWidget);
    expect(find.text('Email hoặc số điện thoại'), findsOneWidget);
    expect(find.text('Mật khẩu Cognito'), findsOneWidget);
    expect(
      find.text(
        'Đăng nhập bằng Cognito rồi gửi access token tới backend TrustBite.',
      ),
      findsOneWidget,
    );
    expect(find.text('Tiếp tục với Cognito'), findsOneWidget);
    expect(find.text('Tiếp tục với Google'), findsOneWidget);

    await tester.tap(find.text('Đăng ký'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Tạo tài khoản qua Cognito; TrustBite chỉ nhận token đã xác thực.',
      ),
      findsOneWidget,
    );
    expect(find.text('Tạo tài khoản Cognito'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Email hoặc số điện thoại'),
      '+84901234567',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Mật khẩu Cognito'),
      'CorrectHorse1!',
    );
    await tester.tap(find.text('Tạo tài khoản Cognito'));
    await tester.pumpAndSettle();

    expect(find.text('Đã đăng nhập với Local Test User.'), findsOneWidget);
  });

  testWidgets('completes an SMS MFA challenge before loading the user', (
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
      find.widgetWithText(TextField, 'Email hoặc số điện thoại'),
      'reviewer@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Mật khẩu Cognito'),
      'CorrectHorse1!',
    );
    await tester.tap(find.text('Tiếp tục với Cognito'));
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

  testWidgets('confirms Cognito signup before signing in', (tester) async {
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

    await tester.tap(find.text('Đăng ký'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Email hoặc số điện thoại'),
      'new-user@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Mật khẩu Cognito'),
      'CorrectHorse1!',
    );
    await tester.tap(find.text('Tạo tài khoản Cognito'));
    await tester.pumpAndSettle();

    expect(
      find.text('Nhập mã Cognito đã gửi để xác nhận tài khoản.'),
      findsOneWidget,
    );
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '654321',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(cognitoGateway.lastSignUpConfirmationCode, '654321');
    expect(cognitoGateway.signInCalls, 1);
    expect(authService.cognitoSignInCalls, 1);
  });
}

class _FakeMobileAuthService implements MobileAuthService {
  int cognitoSignInCalls = 0;
  int localDevelopmentSignUpCalls = 0;

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
  Future<void> signOut() async {}
}

class _FakeCognitoAuthGateway implements CognitoAuthGateway {
  _FakeCognitoAuthGateway({
    List<CognitoAuthResult> results = const [CognitoAuthResult.signedIn()],
  }) : _results = List.of(results);

  final List<CognitoAuthResult> _results;
  String? lastIdentifier;
  String? lastPassword;
  String? lastConfirmationValue;
  String? lastSignUpConfirmationCode;
  int signInCalls = 0;

  @override
  Future<CognitoAuthResult> signIn({
    required String identifier,
    required String password,
  }) async {
    lastIdentifier = identifier;
    lastPassword = password;
    signInCalls += 1;
    return _results.removeAt(0);
  }

  @override
  Future<CognitoAuthResult> signUp({
    required String identifier,
    required String password,
  }) async {
    lastIdentifier = identifier;
    lastPassword = password;
    return _results.removeAt(0);
  }

  @override
  Future<CognitoAuthResult> confirmSignIn(String confirmationValue) async {
    lastConfirmationValue = confirmationValue;
    return _results.removeAt(0);
  }

  @override
  Future<void> confirmSignUp({
    required String identifier,
    required String confirmationCode,
  }) async {
    lastSignUpConfirmationCode = confirmationCode;
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
