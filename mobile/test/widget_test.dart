import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_pages.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/auth/profile_onboarding_screen.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/launch/brand_launch_screen.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_models.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_service.dart';

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
          restaurantRepository: const _FakeRestaurantRepository(),
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
      MaterialApp(
        home: HomeScreen(
          authService: _FakeMobileAuthService(),
          restaurantRepository: const _FakeRestaurantRepository(),
        ),
      ),
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
          restaurantRepository: const _FakeRestaurantRepository(),
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

  testWidgets('loads real favorites and saves an API suggestion', (
    tester,
  ) async {
    final favoritesRepository = _FakeFavoritesRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: _FakeMobileAuthService(),
          cognitoAuthGateway: _FakeCognitoAuthGateway(signedIn: true),
          restaurantRepository: const _FakeRestaurantRepository(),
          favoritesRepository: favoritesRepository,
          notificationRepository: _FakeNotificationRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yêu thích'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('favorites-page')), findsOneWidget);
    expect(find.text('Chưa có quán yêu thích'), findsOneWidget);
    expect(find.text('Gợi ý để lưu'), findsOneWidget);
    expect(find.text('Quán API thử nghiệm'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('save-favorite-restaurant-test')),
    );
    await tester.pumpAndSettle();

    expect(favoritesRepository.savedIds, ['restaurant-test']);
    expect(find.text('Đã lưu'), findsWidgets);
  });

  testWidgets('opens working profile management actions', (tester) async {
    final profileRepository = _FakeProfileManagementRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: _FakeMobileAuthService(),
          cognitoAuthGateway: _FakeCognitoAuthGateway(signedIn: true),
          restaurantRepository: const _FakeRestaurantRepository(),
          notificationRepository: _FakeNotificationRepository(),
          profileRepository: profileRepository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Quét bill'), findsOneWidget);
    expect(find.text('Mã ưu đãi'), findsOneWidget);
    expect(find.text('Hỗ trợ'), findsOneWidget);
    expect(find.text('Bảo mật'), findsOneWidget);
    expect(find.text('Hội viên'), findsOneWidget);
    expect(find.text('Thẻ quà tặng'), findsOneWidget);
    expect(find.text('Giới thiệu bạn bè'), findsOneWidget);
    expect(find.text('Địa chỉ đã lưu'), findsOneWidget);
    expect(find.text('Hóa đơn'), findsOneWidget);
    expect(find.text('Đánh giá ứng dụng'), findsOneWidget);
    expect(find.text('Sửa hồ sơ'), findsNothing);
    expect(find.text('Xóa tài khoản'), findsNothing);
    await tester.tap(find.text('Hạng thành viên'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('gamification-summary')), findsOneWidget);
    expect(find.text('Tập sự'), findsOneWidget);
    expect(find.text('120/500'), findsOneWidget);
    expect(find.text('3/10'), findsOneWidget);
    expect(find.text('Điểm kinh nghiệm'), findsOneWidget);
    expect(find.text('Review xác thực'), findsWidgets);
  });

  testWidgets('opens profile editing and deletion from the signed-in header', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: _FakeMobileAuthService(),
          cognitoAuthGateway: _FakeCognitoAuthGateway(signedIn: true),
          restaurantRepository: const _FakeRestaurantRepository(),
          notificationRepository: _FakeNotificationRepository(),
          profileRepository: _FakeProfileManagementRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tôi'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Local Test User'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('edit-profile-page')), findsOneWidget);
    expect(find.text('Hồ sơ cá nhân'), findsOneWidget);
    expect(find.text('Thông tin cá nhân'), findsOneWidget);
    expect(find.text('Quản lý tài khoản'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('edit-avatar-button')));
    await tester.pumpAndSettle();
    expect(find.text('Cập nhật ảnh đại diện'), findsOneWidget);
    expect(find.byKey(const ValueKey('avatar-source-camera')), findsOneWidget);
    expect(find.byKey(const ValueKey('avatar-source-gallery')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('avatar-source-cancel')));
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const ValueKey('edit-profile-content')),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('open-delete-account-button')),
      findsOneWidget,
    );
  });

  testWidgets('gamification page does not refetch on rebuild', (tester) async {
    final repository = _FakeProfileManagementRepository();

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: GamificationPage(repository: repository),
      ),
    );
    await tester.pumpAndSettle();
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: GamificationPage(repository: repository),
      ),
    );
    await tester.pumpAndSettle();

    expect(repository.fetchGamificationCalls, 1);
  });

  testWidgets('gamification page retries after a loading failure', (
    tester,
  ) async {
    final repository = _FakeProfileManagementRepository(
      gamificationResponses: [Exception('offline')],
    );

    await tester.pumpWidget(
      MaterialApp(home: GamificationPage(repository: repository)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không thể tải hạng thành viên'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('gamification-retry')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('gamification-summary')), findsOneWidget);
    expect(repository.fetchGamificationCalls, 2);
  });

  testWidgets('gamification page refreshes progress on demand', (tester) async {
    final repository = _FakeProfileManagementRepository();

    await tester.pumpWidget(
      MaterialApp(home: GamificationPage(repository: repository)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Làm mới tiến trình'));
    await tester.pumpAndSettle();

    expect(repository.fetchGamificationCalls, 2);
    expect(find.byKey(const ValueKey('gamification-summary')), findsOneWidget);
  });

  testWidgets('gamification page shows awarded badges and top rank', (
    tester,
  ) async {
    final repository = _FakeProfileManagementRepository(
      gamificationResponses: [
        GamificationSummary(
          expPoints: 2400,
          verifiedReviewCount: 31,
          level: const GamificationLevel(
            code: 'TRUSTED_FOODIE',
            label: 'Foodie uy tín',
            minExp: 2000,
            minVerifiedReviews: 25,
          ),
          nextLevel: null,
          badges: [
            GamificationBadge(
              code: 'RECEIPT_MASTER',
              label: 'Bậc thầy hóa đơn',
              iconUrl: null,
              category: 'Xác thực',
              awardedAt: DateTime.utc(2026, 7, 19),
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(home: GamificationPage(repository: repository)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Foodie uy tín'), findsOneWidget);
    expect(
      find.text('Bạn đã đạt hạng cao nhất trong hệ thống hiện tại.'),
      findsOneWidget,
    );
    await tester.scrollUntilVisible(
      find.text('Bậc thầy hóa đơn'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Bậc thầy hóa đơn'), findsOneWidget);
    expect(find.text('19/07/2026'), findsOneWidget);
  });

  testWidgets('account deletion page shows load failures instead of the form', (
    tester,
  ) async {
    final repository = _FakeProfileManagementRepository(
      deletionRequestError: Exception('offline'),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AccountDeletionPage(
          repository: repository,
          onDeletionAccepted: () async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không thể tải yêu cầu xóa'), findsOneWidget);
    expect(find.byKey(const ValueKey('delete-account-submit')), findsNothing);
  });

  testWidgets('asks guests to sign in before opening notifications', (
    tester,
  ) async {
    final notificationRepository = _FakeNotificationRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          authService: _FakeMobileAuthService(),
          restaurantRepository: const _FakeRestaurantRepository(),
          notificationRepository: notificationRepository,
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.notifications_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Email'), findsOneWidget);
    expect(notificationRepository.fetchCalls, 0);
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
          restaurantRepository: const _FakeRestaurantRepository(),
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
          restaurantRepository: const _FakeRestaurantRepository(),
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

class _FakeRestaurantRepository implements RestaurantDiscoveryRepository {
  const _FakeRestaurantRepository();

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    return const [
      HomeRestaurant(
        id: 'restaurant-test',
        name: 'Quán API thử nghiệm',
        rating: '4.8',
        distance: null,
        status: '2 review xác thực',
        image: null,
        featured: false,
      ),
    ];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    return const HomeRestaurantDetail(
      id: 'restaurant-test',
      name: 'Quán API thử nghiệm',
      description: null,
      address: null,
      phoneNumber: null,
      imageUrl: null,
      trustScore: 4.8,
      verifiedReviewCount: 2,
      ratingBreakdown: RestaurantRatingBreakdown(
        averageFood: null,
        averagePrice: null,
        averageService: null,
        averageAmbience: null,
        averageOverall: null,
        reviewCount: 0,
      ),
    );
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) async {
    return const [];
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async {
    return const HomeRestaurantReviewPage(
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    );
  }
}

class _FakeFavoritesRepository implements FavoritesRepository {
  final savedIds = <String>[];

  @override
  Future<List<FavoriteRestaurant>> fetchFavorites() async {
    return [
      for (final id in savedIds)
        FavoriteRestaurant(
          restaurant: HomeRestaurant(
            id: id,
            name: 'Quán API thử nghiệm',
            rating: '4.8',
            distance: null,
            status: '2 review xác thực',
            image: null,
            featured: false,
          ),
          addedAt: DateTime.utc(2026, 7, 19),
        ),
    ];
  }

  @override
  Future<void> removeFavorite(String restaurantId) async {
    savedIds.remove(restaurantId);
  }

  @override
  Future<void> saveFavorite(String restaurantId) async {
    if (!savedIds.contains(restaurantId)) savedIds.add(restaurantId);
  }
}

class _FakeProfileManagementRepository implements ProfileManagementRepository {
  _FakeProfileManagementRepository({
    this.deletionRequestError,
    List<Object>? gamificationResponses,
  }) : _gamificationResponses = [...?gamificationResponses];

  final Exception? deletionRequestError;
  final List<Object> _gamificationResponses;
  int fetchGamificationCalls = 0;

  @override
  Future<GamificationSummary> fetchGamification() async {
    fetchGamificationCalls += 1;
    if (_gamificationResponses.isNotEmpty) {
      final response = _gamificationResponses.removeAt(0);
      if (response is Exception) throw response;
      return response as GamificationSummary;
    }
    return const GamificationSummary(
      expPoints: 120,
      verifiedReviewCount: 3,
      level: GamificationLevel(
        code: 'APPRENTICE',
        label: 'Tập sự',
        minExp: 100,
        minVerifiedReviews: 2,
      ),
      nextLevel: GamificationNextLevel(
        code: 'FOODIE',
        label: 'Foodie',
        minExp: 500,
        minVerifiedReviews: 10,
        expToNext: 380,
        verifiedReviewsToNext: 7,
      ),
      badges: [],
    );
  }

  @override
  Future<Map<String, dynamic>> updateProfile({
    required String displayName,
    required String phoneNumber,
    required String dateOfBirth,
  }) async {
    return {
      'displayName': displayName,
      'phoneNumber': phoneNumber,
      'dateOfBirth': dateOfBirth,
      'profileComplete': true,
    };
  }

  @override
  Future<Map<String, dynamic>> updateAvatar({
    required List<int> bytes,
    required String contentType,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<void> blockReviewAuthor(String reviewId) async {}

  @override
  Future<AccountDeletionRequest> cancelAccountDeletion() {
    throw UnimplementedError();
  }

  @override
  Future<AccountDeletionRequest?> fetchAccountDeletionRequest() async {
    if (deletionRequestError case final error?) throw error;
    return null;
  }

  @override
  Future<AccountDeletionRequest> requestAccountDeletion({String? reason}) {
    throw UnimplementedError();
  }

  @override
  Future<void> submitReport({
    required ReportEntityType entityType,
    required String entityId,
    required String reasonCode,
    String? description,
  }) async {}

  @override
  Future<void> unblockReviewAuthor(String reviewId) async {}
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

class _FakeNotificationRepository implements NotificationRepository {
  int fetchCalls = 0;

  @override
  Future<int> fetchUnreadCount() async => 0;

  @override
  Future<NotificationPageData> fetchNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    fetchCalls += 1;
    return const NotificationPageData(
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      unreadCount: 0,
    );
  }

  @override
  Future<TrustBiteNotification> markRead(String notificationId) {
    throw UnimplementedError();
  }
}
