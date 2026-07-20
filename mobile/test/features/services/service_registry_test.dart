import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';
import 'package:trustbite_mobile/src/features/services/service_registry.dart';

void main() {
  test('registers all eight home services with expected auth boundaries', () {
    final registry = ServiceRegistry.withServices(
      billScanRepository: const _EmptyBillScanRepository(),
      receiptPicker: const _EmptyReceiptPicker(),
      restaurantRepository: const _EmptyRestaurantRepository(),
      favoritesRepository: const _EmptyFavoritesRepository(),
      profileRepository: const _EmptyProfileRepository(),
      ensureAuthenticated: () async => true,
      onAuthenticationRequired: () async {},
      isSignedIn: () => true,
    );

    const publicServices = [
      'Gần quán',
      'Tóm tắt',
      'So sánh',
      'Tìm món',
      'Gợi ý',
    ];
    const protectedServices = ['Quét bill', 'Lưu quán', 'Báo ảo'];

    for (final label in publicServices) {
      expect(registry.entryForShortcut(label), isNotNull);
      expect(
        registry.entryForShortcut(label)!.requiresAuthentication,
        isFalse,
      );
    }
    for (final label in protectedServices) {
      expect(registry.entryForShortcut(label), isNotNull);
      expect(
        registry.entryForShortcut(label)!.requiresAuthentication,
        isTrue,
      );
    }
  });

  testWidgets('Quét bill registry requires login before navigation', (
    tester,
  ) async {
    var authenticated = false;
    var authChecks = 0;
    late final ServiceRegistry registry;
    Future<bool> ensureAuthenticated() async {
      authChecks += 1;
      return authenticated;
    }

    registry = ServiceRegistry.withBillScan(
      repository: const _EmptyBillScanRepository(),
      receiptPicker: const _EmptyReceiptPicker(),
      ensureAuthenticated: ensureAuthenticated,
      onAuthenticationRequired: () async {},
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => registry.open(
                context,
                'Quét bill',
                ensureAuthenticated: ensureAuthenticated,
              ),
              child: const Text('Quét bill'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Quét bill'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('bill-scan-page')), findsNothing);
    expect(authChecks, 1);

    authenticated = true;
    await tester.tap(find.text('Quét bill'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('bill-scan-page')), findsOneWidget);
    expect(authChecks, 2);
  });
}

class _EmptyReceiptPicker implements BillReceiptPicker {
  const _EmptyReceiptPicker();

  @override
  Future<BillReceiptFile?> pick(BillReceiptSource source) async => null;
}

class _EmptyBillScanRepository implements BillScanRepository {
  const _EmptyBillScanRepository();

  @override
  Future<List<BillScanRestaurant>> fetchRestaurants() async => const [];

  @override
  Future<List<BillScanBranch>> fetchBranches(String restaurantId) async =>
      const [];

  @override
  Future<BillScanResult> fetchScan(String scanId) {
    throw UnimplementedError();
  }

  @override
  Future<BillScanResult> submitScan({
    required String restaurantId,
    required String branchId,
    required BillReceiptFile receipt,
  }) {
    throw UnimplementedError();
  }
}

class _EmptyRestaurantRepository implements RestaurantDiscoveryRepository {
  const _EmptyRestaurantRepository();

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) async =>
      const [];

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async => const HomeRestaurantReviewPage(
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
  );

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async => const [];
}

class _EmptyFavoritesRepository implements FavoritesRepository {
  const _EmptyFavoritesRepository();

  @override
  Future<List<FavoriteRestaurant>> fetchFavorites() async => const [];

  @override
  Future<void> removeFavorite(String restaurantId) async {}

  @override
  Future<void> saveFavorite(String restaurantId) async {}
}

class _EmptyProfileRepository implements ProfileManagementRepository {
  const _EmptyProfileRepository();

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
  }) async {}

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
