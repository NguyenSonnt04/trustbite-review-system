import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/home/pages/discover_page.dart';
import 'package:trustbite_mobile/src/features/reviews/review_reaction_service.dart';

void main() {
  Widget buildPage(
    RestaurantDiscoveryRepository repository, {
    bool isSignedIn = false,
    Future<bool> Function()? onLogin,
    ReviewReactionRepository? reviewReactionRepository,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: DiscoverPage(
          activeServiceIndex: 0,
          onServiceSelected: (_) {},
          isSignedIn: isSignedIn,
          currentUser: null,
          onLogin: onLogin ?? () async => true,
          restaurantRepository: repository,
          reviewReactionRepository: reviewReactionRepository,
        ),
      ),
    );
  }

  testWidgets('renders backend restaurants and their image URLs', (
    tester,
  ) async {
    await tester.pumpWidget(
      buildPage(
        const _FakeRestaurantRepository([
          HomeRestaurant(
            id: 'restaurant-1',
            name: 'Phở API Thật',
            rating: '4.8',
            distance: '0.5 km',
            status: '12 review xác thực',
            image: 'https://cdn.example.test/pho.jpg',
            featured: false,
          ),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Phở API Thật'), findsOneWidget);
    final image = tester.widget<OptimizedNetworkImage>(
      find.descendant(
        of: find.byKey(const ValueKey('nearby-restaurants-list')),
        matching: find.byType(OptimizedNetworkImage),
      ),
    );
    expect(image.imageUrl, 'https://cdn.example.test/pho.jpg');
  });

  testWidgets('opens the selected backend restaurant detail', (tester) async {
    var loginCalls = 0;
    await tester.pumpWidget(
      buildPage(
        _FakeRestaurantRepository(
          [
            const HomeRestaurant(
              id: 'restaurant-detail',
              name: 'Quán Có Chi Tiết',
              rating: '4.7',
              distance: null,
              status: '8 review xác thực',
              image: null,
              featured: false,
            ),
          ],
          detail: const HomeRestaurantDetail(
            id: 'restaurant-detail',
            name: 'Quán Có Chi Tiết',
            description: 'Món Việt nấu trong ngày.',
            address: '1 Nguyễn Huệ, Quận 1',
            phoneNumber: null,
            imageUrl: null,
            trustScore: 4.7,
            verifiedReviewCount: 8,
            ratingBreakdown: RestaurantRatingBreakdown(
              averageFood: 4.8,
              averagePrice: 4.2,
              averageService: 4.5,
              averageAmbience: 4.1,
              averageOverall: 4.4,
              reviewCount: 10,
            ),
          ),
          menuItems: [
            const HomeMenuItem(
              id: 'menu-1',
              name: 'Phở bò tái',
              price: 65000,
              currency: 'VND',
            ),
          ],
          reviews: HomeRestaurantReviewPage(
            items: [
              HomeRestaurantReview(
                id: 'review-1',
                restaurantId: 'restaurant-detail',
                branchId: null,
                foodRating: 5,
                priceRating: 4,
                serviceRating: 5,
                ambienceRating: 4,
                averageRating: 4.5,
                reviewerDisplayName: 'Nguyễn An',
                reviewerAvatarUrl:
                    'https://cdn.trustbite.test/avatars/nguyen-an.png',
                comment: 'Món ăn thật từ backend và phục vụ rất nhiệt tình.',
                status: 'VERIFIED',
                verificationStatus: 'VERIFIED',
                trustLabel: 'RECEIPT_VERIFIED',
                visitedAt: null,
                createdAt: DateTime.utc(2026, 7, 13),
              ),
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          ),
        ),
        onLogin: () async {
          loginCalls += 1;
          return true;
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quán Có Chi Tiết'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('restaurant-detail-page')),
      findsOneWidget,
    );
    expect(find.text('Món Việt nấu trong ngày.'), findsOneWidget);
    expect(find.text('1 Nguyễn Huệ, Quận 1'), findsOneWidget);
    expect(find.text('4.8'), findsWidgets);
    expect(find.byKey(const ValueKey('rating-summary-card')), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Thực đơn điện tử'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(find.text('65.000 ₫'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Bình luận từ cộng đồng'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Bình luận mẫu'), findsNothing);
    expect(
      find.text('Món ăn thật từ backend và phục vụ rất nhiệt tình.'),
      findsOneWidget,
    );
    expect(find.text('Nguyễn An'), findsOneWidget);
    final reviewerAvatar = tester.widget<CircleAvatar>(
      find.byKey(const ValueKey('reviewer-avatar-review-1')),
    );
    expect(reviewerAvatar.foregroundImage, isA<NetworkImage>());
    expect(
      (reviewerAvatar.foregroundImage! as NetworkImage).url,
      'https://cdn.trustbite.test/avatars/nguyen-an.png',
    );
    expect(find.text('Đánh giá công khai'), findsNothing);
    expect(find.text('Đã xác thực'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('restaurant-review-bubble')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('restaurant-review-card-review-1')),
      findsOneWidget,
    );
    await tester.ensureVisible(
      find.byKey(const ValueKey('write-review-button')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('write-review-button')));
    await tester.pumpAndSettle();
    expect(loginCalls, 1);
    expect(find.byKey(const ValueKey('review-creation-page')), findsOneWidget);
  });

  testWidgets('collapses long comments and supports three reactions', (
    tester,
  ) async {
    const longComment =
        'Harness the power of AI and machine learning with a comprehensive '
        'suite of services. These workshops provide hands-on experience '
        'building intelligent applications that solve real-world problems. '
        'Master both pre-built AI services and custom model development, '
        'deployment, and management with practical production guidance.';
    await tester.pumpWidget(
      buildPage(
        _FakeRestaurantRepository(
          const [
            HomeRestaurant(
              id: 'restaurant-long-review',
              name: 'Quán bình luận dài',
              rating: '5.0',
              distance: null,
              status: '1 review xác thực',
              image: null,
              featured: false,
            ),
          ],
          detail: const HomeRestaurantDetail(
            id: 'restaurant-long-review',
            name: 'Quán bình luận dài',
            description: null,
            address: null,
            phoneNumber: null,
            imageUrl: null,
            trustScore: 5,
            verifiedReviewCount: 1,
            ratingBreakdown: RestaurantRatingBreakdown(
              averageFood: 5,
              averagePrice: 5,
              averageService: 5,
              averageAmbience: 5,
              averageOverall: 5,
              reviewCount: 1,
            ),
          ),
          reviews: HomeRestaurantReviewPage(
            items: [
              HomeRestaurantReview(
                id: 'review-long',
                restaurantId: 'restaurant-long-review',
                branchId: null,
                foodRating: 5,
                priceRating: 5,
                serviceRating: 5,
                ambienceRating: 5,
                averageRating: 5,
                reviewerDisplayName: 'Nguyen Dao Son',
                comment: longComment,
                status: 'VERIFIED',
                verificationStatus: 'VERIFIED',
                trustLabel: 'RECEIPT_VERIFIED',
                visitedAt: null,
                createdAt: DateTime.utc(2026, 7, 15),
              ),
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          ),
        ),
        isSignedIn: true,
        reviewReactionRepository: const _FakeReviewReactionRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quán bình luận dài'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Xem thêm'),
      250,
      scrollable: find.byType(Scrollable).last,
    );

    expect(find.text('Xem thêm'), findsOneWidget);
    await tester.ensureVisible(find.text('Xem thêm'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xem thêm'));
    await tester.pumpAndSettle();
    expect(find.text('Xem bớt'), findsOneWidget);
    await tester.tap(find.text('Xem bớt'));
    await tester.pumpAndSettle();

    final reactionTarget = find.byKey(
      const ValueKey('review-reaction-target-review-long'),
    );
    await tester.ensureVisible(reactionTarget);
    await tester.pumpAndSettle();
    await tester.longPress(reactionTarget);
    await tester.pumpAndSettle();
    expect(find.text('❤️'), findsOneWidget);
    expect(find.text('😆'), findsOneWidget);
    expect(find.text('😡'), findsOneWidget);

    await tester.tap(find.text('❤️'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('selected-reaction-review-long')),
      findsOneWidget,
    );
  });

  testWidgets('retries a failed restaurant detail request', (tester) async {
    final repository = _DetailFailingOnceRestaurantRepository();
    await tester.pumpWidget(
      buildPage(
        repository,
        isSignedIn: true,
        reviewReactionRepository: const _FakeReviewReactionRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quán thử lại chi tiết'));
    await tester.pumpAndSettle();
    expect(find.text('Không thể tải chi tiết nhà hàng.'), findsOneWidget);
    expect(find.text('Menu vẫn tải'), findsOneWidget);
    expect(find.text('Bình luận vẫn tải.'), findsOneWidget);
    expect(repository.menuCalls, 1);
    expect(repository.reviewCalls, 1);

    final reactionTarget = find.byKey(
      const ValueKey('review-reaction-target-review-detail-failure'),
    );
    await tester.ensureVisible(reactionTarget);
    await tester.pumpAndSettle();
    await tester.longPress(reactionTarget);
    await tester.pumpAndSettle();
    await tester.tap(find.text('❤️'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('selected-reaction-review-detail-failure')),
      findsOneWidget,
    );

    await tester.ensureVisible(find.text('Thử lại'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thử lại'));
    await tester.pump();
    expect(find.text('Menu vẫn tải'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('restaurant-menu-loading')),
      findsNothing,
    );
    await tester.pumpAndSettle();
    expect(find.text('Chi tiết đã tải lại.'), findsOneWidget);
    expect(repository.menuCalls, 1);
    expect(repository.reviewCalls, 1);
    expect(
      find.byKey(const ValueKey('selected-reaction-review-detail-failure')),
      findsOneWidget,
    );
  });

  testWidgets('retries only the failed restaurant menu section', (
    tester,
  ) async {
    final repository = _MenuFailingOnceRestaurantRepository();
    await tester.pumpWidget(buildPage(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quán thử lại thực đơn'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Không thể tải thực đơn.'),
      250,
      scrollable: find.byType(Scrollable).last,
    );

    await tester.ensureVisible(find.text('Thử lại thực đơn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thử lại thực đơn'));
    await tester.pumpAndSettle();
    expect(find.text('Cơm gà tải lại'), findsOneWidget);
    expect(repository.detailCalls, 1);
  });

  testWidgets('retries only the failed public reviews section', (tester) async {
    final repository = _ReviewsFailingOnceRestaurantRepository();
    await tester.pumpWidget(buildPage(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quán thử lại bình luận'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Không thể tải bình luận.'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.ensureVisible(find.text('Thử lại bình luận'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Thử lại bình luận'));
    await tester.pumpAndSettle();

    expect(find.text('Bình luận backend tải lại.'), findsOneWidget);
    final defaultAvatar = tester.widget<CircleAvatar>(
      find.byKey(const ValueKey('reviewer-avatar-review-retry')),
    );
    expect(defaultAvatar.foregroundImage, isNull);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('reviewer-avatar-review-retry')),
        matching: find.byIcon(Icons.person_rounded),
      ),
      findsOneWidget,
    );
    expect(repository.detailCalls, 1);
  });

  testWidgets('shows loading, empty, and retry states', (tester) async {
    final completer = Completer<List<HomeRestaurant>>();
    final repository = _SequencedRestaurantRepository([
      completer.future,
      Future.value([
        const HomeRestaurant(
          id: 'restaurant-2',
          name: 'Bún retry',
          rating: 'Mới',
          distance: null,
          status: 'Chưa có review xác thực',
          image: null,
          featured: false,
        ),
      ]),
    ]);

    await tester.pumpWidget(buildPage(repository));
    expect(
      find.byKey(const ValueKey('nearby-restaurants-loading')),
      findsOneWidget,
    );

    completer.complete(const []);
    await tester.pumpAndSettle();
    expect(find.text('Chưa có quán nào để hiển thị.'), findsOneWidget);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Bún retry'), findsOneWidget);
  });

  testWidgets('shows API failure and retries successfully', (tester) async {
    final repository = _FailingOnceRestaurantRepository();

    await tester.pumpWidget(buildPage(repository));
    await tester.pumpAndSettle();

    expect(find.text('Không thể tải danh sách quán.'), findsOneWidget);
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Cơm retry'), findsOneWidget);
  });
}

class _FakeRestaurantRepository implements RestaurantDiscoveryRepository {
  const _FakeRestaurantRepository(
    this.restaurants, {
    this.detail = const HomeRestaurantDetail(
      id: 'restaurant-default',
      name: 'Quán thử nghiệm',
      description: null,
      address: null,
      phoneNumber: null,
      imageUrl: null,
      trustScore: null,
      verifiedReviewCount: 0,
      ratingBreakdown: RestaurantRatingBreakdown(
        averageFood: null,
        averagePrice: null,
        averageService: null,
        averageAmbience: null,
        averageOverall: null,
        reviewCount: 0,
      ),
    ),
    this.menuItems = const [],
    this.reviews = const HomeRestaurantReviewPage(
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    ),
  });

  final List<HomeRestaurant> restaurants;
  final HomeRestaurantDetail detail;
  final List<HomeMenuItem> menuItems;
  final HomeRestaurantReviewPage reviews;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async => restaurants;

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    return detail;
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) async {
    return menuItems;
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async {
    return reviews;
  }
}

class _DetailFailingOnceRestaurantRepository
    implements RestaurantDiscoveryRepository {
  var _detailCalls = 0;
  var menuCalls = 0;
  var reviewCalls = 0;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    return const [
      HomeRestaurant(
        id: 'restaurant-detail-retry',
        name: 'Quán thử lại chi tiết',
        rating: '4.5',
        distance: null,
        status: '5 review xác thực',
        image: null,
        featured: false,
      ),
    ];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    _detailCalls += 1;
    if (_detailCalls == 1) {
      throw Exception('offline');
    }
    return const HomeRestaurantDetail(
      id: 'restaurant-detail-retry',
      name: 'Quán thử lại chi tiết',
      description: 'Chi tiết đã tải lại.',
      address: null,
      phoneNumber: null,
      imageUrl: null,
      trustScore: 4.5,
      verifiedReviewCount: 5,
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
    menuCalls += 1;
    return const [
      HomeMenuItem(
        id: 'menu-detail-failure',
        name: 'Menu vẫn tải',
        price: 45000,
        currency: 'VND',
      ),
    ];
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async {
    reviewCalls += 1;
    return HomeRestaurantReviewPage(
      items: [
        HomeRestaurantReview(
          id: 'review-detail-failure',
          restaurantId: restaurantId,
          branchId: null,
          foodRating: 4,
          priceRating: 4,
          serviceRating: 4,
          ambienceRating: 4,
          averageRating: 4,
          reviewerDisplayName: 'Người dùng TrustBite',
          comment: 'Bình luận vẫn tải.',
          status: 'VERIFIED',
          verificationStatus: 'VERIFIED',
          trustLabel: 'RECEIPT_VERIFIED',
          visitedAt: null,
          createdAt: DateTime.utc(2026, 7, 15),
        ),
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    );
  }
}

class _FakeReviewReactionRepository implements ReviewReactionRepository {
  const _FakeReviewReactionRepository();

  @override
  Future<ReviewReactionResult> removeReaction(String reviewId) async {
    return ReviewReactionResult(
      reviewId: reviewId,
      myReaction: null,
      reactionCounts: const ReviewReactionCounts(),
    );
  }

  @override
  Future<ReviewReactionResult> setReaction({
    required String reviewId,
    required ReviewReactionType reaction,
  }) async {
    return ReviewReactionResult(
      reviewId: reviewId,
      myReaction: reaction,
      reactionCounts: ReviewReactionCounts(
        love: reaction == ReviewReactionType.love ? 1 : 0,
        haha: reaction == ReviewReactionType.haha ? 1 : 0,
        angry: reaction == ReviewReactionType.angry ? 1 : 0,
      ),
    );
  }
}

class _SequencedRestaurantRepository implements RestaurantDiscoveryRepository {
  _SequencedRestaurantRepository(this.results);

  final List<Future<List<HomeRestaurant>>> results;
  int _index = 0;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() {
    return results[_index++];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(String restaurantId) {
    throw UnimplementedError();
  }
}

class _MenuFailingOnceRestaurantRepository
    implements RestaurantDiscoveryRepository {
  var detailCalls = 0;
  var _menuCalls = 0;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    return const [
      HomeRestaurant(
        id: 'restaurant-menu-retry',
        name: 'Quán thử lại thực đơn',
        rating: '4.6',
        distance: null,
        status: '4 review xác thực',
        image: null,
        featured: false,
      ),
    ];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    detailCalls += 1;
    return const HomeRestaurantDetail(
      id: 'restaurant-menu-retry',
      name: 'Quán thử lại thực đơn',
      description: null,
      address: null,
      phoneNumber: null,
      imageUrl: null,
      trustScore: 4.6,
      verifiedReviewCount: 4,
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
    _menuCalls += 1;
    if (_menuCalls == 1) {
      throw Exception('menu offline');
    }
    return const [
      HomeMenuItem(
        id: 'menu-retry',
        name: 'Cơm gà tải lại',
        price: 55000,
        currency: 'VND',
      ),
    ];
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

class _ReviewsFailingOnceRestaurantRepository
    implements RestaurantDiscoveryRepository {
  var detailCalls = 0;
  var _reviewCalls = 0;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    return const [
      HomeRestaurant(
        id: 'restaurant-reviews-retry',
        name: 'Quán thử lại bình luận',
        rating: '4.7',
        distance: null,
        status: '1 review xác thực',
        image: null,
        featured: false,
      ),
    ];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    detailCalls += 1;
    return const HomeRestaurantDetail(
      id: 'restaurant-reviews-retry',
      name: 'Quán thử lại bình luận',
      description: null,
      address: null,
      phoneNumber: null,
      imageUrl: null,
      trustScore: 4.7,
      verifiedReviewCount: 1,
      ratingBreakdown: RestaurantRatingBreakdown(
        averageFood: 5,
        averagePrice: 4,
        averageService: 5,
        averageAmbience: 4,
        averageOverall: 4.5,
        reviewCount: 1,
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
    _reviewCalls += 1;
    if (_reviewCalls == 1) {
      throw Exception('reviews offline');
    }
    return HomeRestaurantReviewPage(
      items: [
        HomeRestaurantReview(
          id: 'review-retry',
          restaurantId: restaurantId,
          branchId: null,
          foodRating: 5,
          priceRating: 4,
          serviceRating: 5,
          ambienceRating: 4,
          averageRating: 4.5,
          reviewerDisplayName: 'Người dùng TrustBite',
          comment: 'Bình luận backend tải lại.',
          status: 'VERIFIED',
          verificationStatus: 'VERIFIED',
          trustLabel: 'RECEIPT_VERIFIED',
          visitedAt: null,
          createdAt: DateTime.now().toUtc(),
        ),
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    );
  }
}

class _FailingOnceRestaurantRepository
    implements RestaurantDiscoveryRepository {
  var _calls = 0;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    _calls += 1;
    if (_calls == 1) {
      throw Exception('offline');
    }
    return const [
      HomeRestaurant(
        id: 'restaurant-3',
        name: 'Cơm retry',
        rating: '4.5',
        distance: null,
        status: '3 review xác thực',
        image: null,
        featured: false,
      ),
    ];
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(String restaurantId) {
    throw UnimplementedError();
  }
}
