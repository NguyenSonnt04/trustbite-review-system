import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/compare/compare_page.dart';
import 'package:trustbite_mobile/src/features/services/dish_search/dish_search_page.dart';
import 'package:trustbite_mobile/src/features/services/recommendations/recommendations_page.dart';
import 'package:trustbite_mobile/src/features/services/report_fake/report_fake_page.dart';
import 'package:trustbite_mobile/src/features/services/save_restaurant/save_restaurant_page.dart';
import 'package:trustbite_mobile/src/features/services/summary/summary_page.dart';

void main() {
  testWidgets('recommendations render trust-ranked API restaurants', (
    tester,
  ) async {
    const repository = _ServiceRestaurantRepository();
    await tester.pumpWidget(
      const MaterialApp(
        home: RecommendationsServicePage(restaurantRepository: repository),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('recommendations-service-page')),
      findsOneWidget,
    );
    expect(find.text('Dữ liệu API'), findsNothing);
    expect(find.text('Phở TrustBite'), findsOneWidget);
    expect(find.textContaining('Không biết ăn gì?'), findsOneWidget);
  });

  testWidgets('summary labels mock summary over real review data', (
    tester,
  ) async {
    const repository = _ServiceRestaurantRepository();
    await tester.pumpWidget(
      const MaterialApp(
        home: SummaryServicePage(restaurantRepository: repository),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('summary-restaurant-picker')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('restaurant-picker-search')),
      findsOneWidget,
    );
    await tester.enterText(
      find.byKey(const ValueKey('restaurant-picker-search')),
      'pho',
    );
    await tester.pumpAndSettle();
    expect(find.text('Phở TrustBite'), findsOneWidget);
    await tester.tap(find.text('Phở TrustBite').last);
    await tester.pumpAndSettle();

    expect(find.text('API + dữ liệu mẫu'), findsNothing);
    expect(find.textContaining('Đọc nhiều review'), findsOneWidget);
    expect(find.textContaining('UI mẫu'), findsOneWidget);
    expect(find.textContaining('1/8 review công khai'), findsOneWidget);
    expect(find.textContaining('Nước dùng đậm vị'), findsOneWidget);
  });

  testWidgets('dish search filters a real restaurant menu locally', (
    tester,
  ) async {
    const repository = _ServiceRestaurantRepository();
    await tester.pumpWidget(
      const MaterialApp(
        home: DishSearchServicePage(restaurantRepository: repository),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('dish-search-restaurant-picker')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phở TrustBite').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('dish-search-field')),
      'tái',
    );
    await tester.pumpAndSettle();

    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(find.text('Bánh mì'), findsNothing);
    expect(find.textContaining('Gõ món.'), findsOneWidget);
    expect(find.textContaining('tối đa 50 món đầu tiên'), findsOneWidget);
  });

  testWidgets('comparison uses two visual restaurant selectors', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: CompareServicePage(
          restaurantRepository: _ServiceRestaurantRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Hai quán.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('compare-left-picker')));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('restaurant-picker-option-restaurant-1')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('compare-right-picker')));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('restaurant-picker-option-restaurant-2')),
    );
    await tester.pumpAndSettle();
    final submitButton = find.byKey(const ValueKey('compare-submit-button'));
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(find.text('Bảng đối đầu'), findsOneWidget);
    expect(find.text('Phở TrustBite'), findsWidgets);
    expect(find.text('Bún Nhà Mình'), findsWidgets);
  });

  testWidgets('saved service switches to login after an expired session', (
    tester,
  ) async {
    var authRequiredCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: SaveRestaurantServicePage(
          onLogin: () async => true,
          onAuthenticationRequired: () async => authRequiredCalls += 1,
          favoritesRepository: const _ExpiredFavoritesRepository(),
          restaurantRepository: const _ServiceRestaurantRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(authRequiredCalls, 1);
    expect(find.text('Đăng nhập để đồng bộ quán yêu thích'), findsOneWidget);
  });

  testWidgets('report fake hands expired sessions back to authentication', (
    tester,
  ) async {
    var authRequiredCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: ReportFakeServicePage(
          restaurantRepository: const _ServiceRestaurantRepository(),
          reportRepository: const _ExpiredProfileRepository(),
          onAuthenticationRequired: () async => authRequiredCalls += 1,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Giữ cộng đồng'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('report-restaurant-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phở TrustBite').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('report-submit-button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('submit-report-button')));
    await tester.pumpAndSettle();

    expect(authRequiredCalls, 1);
  });
}

class _ServiceRestaurantRepository implements RestaurantDiscoveryRepository {
  const _ServiceRestaurantRepository();

  static const restaurant = HomeRestaurant(
    id: 'restaurant-1',
    name: 'Phở TrustBite',
    rating: '4.8',
    distance: '1,2 km',
    status: '12 review xác thực',
    image: null,
    featured: false,
  );
  static const secondRestaurant = HomeRestaurant(
    id: 'restaurant-2',
    name: 'Bún Nhà Mình',
    rating: '4.6',
    distance: '2,1 km',
    status: '9 review xác thực',
    image: null,
    featured: false,
  );

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async => const [
    restaurant,
    secondRestaurant,
  ];

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async => HomeRestaurantDetail(
    id: restaurantId,
    name: restaurantId == 'restaurant-1' ? 'Phở TrustBite' : 'Bún Nhà Mình',
    description: null,
    address: '12 Nguyễn Huệ',
    phoneNumber: null,
    imageUrl: null,
    trustScore: 4.8,
    verifiedReviewCount: 12,
    ratingBreakdown: const RestaurantRatingBreakdown(
      averageFood: 4.8,
      averagePrice: 4.5,
      averageService: 4.7,
      averageAmbience: 4.4,
      averageOverall: 4.6,
      reviewCount: 12,
    ),
  );

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(
    String restaurantId,
  ) async => const [
    HomeMenuItem(
      id: 'menu-1',
      name: 'Phở bò tái',
      price: 65000,
      currency: 'VND',
    ),
    HomeMenuItem(id: 'menu-2', name: 'Bánh mì', price: 30000, currency: 'VND'),
  ];

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async => HomeRestaurantReviewPage(
    items: [
      HomeRestaurantReview(
        id: 'review-1',
        restaurantId: restaurantId,
        branchId: null,
        foodRating: 5,
        priceRating: 4,
        serviceRating: 5,
        ambienceRating: 4,
        averageRating: 4.5,
        reviewerDisplayName: 'Minh',
        comment: 'Nước dùng đậm vị và giá hợp lý.',
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        trustLabel: 'Đã xác thực',
        visitedAt: DateTime.utc(2026, 7, 19),
        createdAt: DateTime.utc(2026, 7, 20),
      ),
    ],
    page: 1,
    pageSize: 20,
    total: 8,
  );
}

class _ExpiredFavoritesRepository implements FavoritesRepository {
  const _ExpiredFavoritesRepository();

  @override
  Future<List<FavoriteRestaurant>> fetchFavorites() {
    throw const AuthRequiredException(401, 'expired');
  }

  @override
  Future<void> removeFavorite(String restaurantId) {
    throw const AuthRequiredException(401, 'expired');
  }

  @override
  Future<void> saveFavorite(String restaurantId) {
    throw const AuthRequiredException(401, 'expired');
  }
}

class _ExpiredProfileRepository implements ProfileManagementRepository {
  const _ExpiredProfileRepository();

  @override
  Future<void> blockReviewAuthor(String reviewId) {
    throw UnimplementedError();
  }

  @override
  Future<AccountDeletionRequest> cancelAccountDeletion() {
    throw UnimplementedError();
  }

  @override
  Future<AccountDeletionRequest?> fetchAccountDeletionRequest() {
    throw UnimplementedError();
  }

  @override
  Future<GamificationSummary> fetchGamification() {
    throw UnimplementedError();
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
  }) {
    throw const AuthRequiredException(401, 'expired');
  }

  @override
  Future<void> unblockReviewAuthor(String reviewId) {
    throw UnimplementedError();
  }

  @override
  Future<Map<String, dynamic>> updateAvatar({
    required List<int> bytes,
    required String contentType,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<Map<String, dynamic>> updateProfile({
    required String displayName,
    required String phoneNumber,
    required String dateOfBirth,
  }) {
    throw UnimplementedError();
  }
}
