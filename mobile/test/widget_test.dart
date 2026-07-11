import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/auth/profile_onboarding_screen.dart';
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

    expect(cognitoGateway.lastSignUpConfirmationValue, '654321');
    expect(cognitoGateway.confirmSignUpCalls, 1);
    expect(authService.cognitoSignInCalls, 1);
  });

  testWidgets('returns to email entry when the Cognito session has expired', (
    tester,
  ) async {
    final cognitoGateway = _FakeCognitoAuthGateway(
      results: const [CognitoAuthResult(CognitoAuthStep.confirmSignUp)],
      confirmSignUpError: const CognitoAuthGatewayException(
        'Phiên đăng ký đã hết hạn. Vui lòng nhập email lại.',
        restartAuthentication: true,
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          authService: _FakeMobileAuthService(),
          cognitoAuthGateway: cognitoGateway,
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Email'),
      'expired@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('cognito-confirmation-field')),
      '123456',
    );
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, 'Email'), findsOneWidget);
    expect(
      find.text('Phiên đăng ký đã hết hạn. Vui lòng nhập email lại.'),
      findsOneWidget,
    );
  });

  testWidgets('retries backend completion without repeating Cognito auth', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService(
      cognitoResults: [
        const ApiException(503, 'Không thể kết nối máy chủ TrustBite.'),
        {
          'displayName': 'Retry User',
          'phoneNumber': '+84901234567',
          'dateOfBirth': '1990-01-01',
          'profileComplete': true,
        },
      ],
    );
    final cognitoGateway = _FakeCognitoAuthGateway(
      results: const [CognitoAuthResult.signedIn()],
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
      'retry@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.text('Thử lại'), findsOneWidget);
    expect(cognitoGateway.requestOtpCalls, 1);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(cognitoGateway.requestOtpCalls, 1);
    expect(authService.cognitoSignInCalls, 2);
    expect(find.text('Đã đăng nhập với Retry User.'), findsOneWidget);
  });

  testWidgets('requires incomplete Cognito users to finish their profile', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService(
      cognitoResults: [
        {
          'displayName': null,
          'phoneNumber': null,
          'dateOfBirth': '2000-01-01',
          'profileComplete': false,
        },
      ],
    );
    final cognitoGateway = _FakeCognitoAuthGateway(
      results: const [CognitoAuthResult.signedIn()],
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
      'onboarding@example.com',
    );
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.byType(ProfileOnboardingScreen), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('profile-name-field')),
      'Nguyen Son',
    );
    await tester.enterText(
      find.byKey(const ValueKey('profile-phone-field')),
      '0395665937',
    );
    await tester.tap(find.byKey(const ValueKey('profile-submit-button')));
    await tester.pumpAndSettle();

    expect(authService.completeProfileCalls, 1);
    expect(authService.lastProfilePhoneNumber, '0395665937');
    expect(find.text('Đã đăng nhập với Nguyen Son.'), findsOneWidget);
  });

  testWidgets('restores incomplete signed-in users into profile onboarding', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService(
      cognitoResults: [
        {
          'displayName': null,
          'phoneNumber': null,
          'dateOfBirth': null,
          'profileComplete': false,
        },
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: authService,
          cognitoAuthGateway: _FakeCognitoAuthGateway(signedIn: true),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(ProfileOnboardingScreen), findsOneWidget);
    expect(authService.cognitoSignInCalls, 1);
  });

  testWidgets('explains a temporary failure while restoring a signed-in user', (
    tester,
  ) async {
    final authService = _FakeMobileAuthService(
      cognitoResults: [Exception('backend unavailable')],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: authService,
          cognitoAuthGateway: _FakeCognitoAuthGateway(signedIn: true),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Không thể khôi phục phiên đăng nhập. Vui lòng kiểm tra kết nối và thử lại.',
      ),
      findsOneWidget,
    );
    expect(authService.cognitoSignInCalls, 1);
  });
}

class _FakeMobileAuthService implements MobileAuthService {
  _FakeMobileAuthService({List<Object>? cognitoResults})
    : _cognitoResults = cognitoResults == null ? null : List.of(cognitoResults);

  final List<Object>? _cognitoResults;
  int cognitoSignInCalls = 0;
  int localDevelopmentSignUpCalls = 0;
  int signOutCalls = 0;
  int completeProfileCalls = 0;
  String? lastProfilePhoneNumber;

  @override
  Future<Map<String, dynamic>> completeCognitoSignIn() async {
    cognitoSignInCalls += 1;
    final result = _cognitoResults?.removeAt(0);
    if (result is Exception) throw result;
    if (result is Map<String, dynamic>) return result;
    return {
      'displayName': 'Local Test User',
      'phoneNumber': '+84901234567',
      'dateOfBirth': '1990-01-01',
      'profileComplete': true,
    };
  }

  @override
  Future<Map<String, dynamic>> loadCurrentUser() => completeCognitoSignIn();

  @override
  Future<Map<String, dynamic>> completeProfile({
    required String displayName,
    required String dateOfBirth,
    required String phoneNumber,
  }) async {
    completeProfileCalls += 1;
    lastProfilePhoneNumber = phoneNumber;
    return {
      'displayName': displayName.trim(),
      'phoneNumber': '+84395665937',
      'dateOfBirth': dateOfBirth,
      'profileComplete': true,
    };
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
    this.confirmSignUpError,
    this.signedIn = false,
  }) : _results = List.of(results);

  final List<CognitoAuthResult> _results;
  final CognitoAuthGatewayException? confirmSignUpError;
  final bool signedIn;
  String? lastIdentifier;
  String? lastConfirmationValue;
  String? lastSignUpConfirmationValue;
  int requestOtpCalls = 0;
  int confirmSignUpCalls = 0;

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
  Future<CognitoAuthResult> confirmSignUp({
    required String identifier,
    required String confirmationValue,
  }) async {
    lastIdentifier = identifier;
    lastSignUpConfirmationValue = confirmationValue;
    confirmSignUpCalls += 1;
    if (confirmSignUpError case final error?) throw error;
    return _results.removeAt(0);
  }

  @override
  Future<String?> getAccessToken() async => 'cognito-access-token';

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> isSignedIn() async => signedIn;

  @override
  Future<void> signOut() async {}
}
