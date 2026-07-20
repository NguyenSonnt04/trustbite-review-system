import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_page.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';
import 'package:trustbite_mobile/src/features/services/compare/compare_page.dart';
import 'package:trustbite_mobile/src/features/services/dish_search/dish_search_page.dart';
import 'package:trustbite_mobile/src/features/services/nearby/nearby_page.dart';
import 'package:trustbite_mobile/src/features/services/recommendations/recommendations_page.dart';
import 'package:trustbite_mobile/src/features/services/report_fake/report_fake_page.dart';
import 'package:trustbite_mobile/src/features/services/save_restaurant/save_restaurant_page.dart';
import 'package:trustbite_mobile/src/features/services/summary/summary_page.dart';

enum TrustBiteServiceId {
  billScan,
  nearby,
  summary,
  compare,
  saveRestaurant,
  reportFake,
  dishSearch,
  recommendations,
}

typedef ServicePageBuilder = Widget Function(BuildContext context);

class ServiceRegistryEntry {
  const ServiceRegistryEntry({
    required this.id,
    required this.shortcutLabel,
    required this.requiresAuthentication,
    required this.pageBuilder,
  });

  final TrustBiteServiceId id;
  final String shortcutLabel;
  final bool requiresAuthentication;
  final ServicePageBuilder pageBuilder;
}

class ServiceRegistry {
  ServiceRegistry(Iterable<ServiceRegistryEntry> entries)
    : _entries = {for (final entry in entries) entry.shortcutLabel: entry};

  factory ServiceRegistry.withBillScan({
    required BillScanRepository repository,
    required BillReceiptPicker receiptPicker,
    required Future<bool> Function() ensureAuthenticated,
    required Future<void> Function() onAuthenticationRequired,
  }) {
    return ServiceRegistry([
      ServiceRegistryEntry(
        id: TrustBiteServiceId.billScan,
        shortcutLabel: 'Quét bill',
        requiresAuthentication: true,
        pageBuilder: (_) => BillScanPage(
          repository: repository,
          receiptPicker: receiptPicker,
          ensureAuthenticated: ensureAuthenticated,
          onAuthenticationRequired: onAuthenticationRequired,
        ),
      ),
    ]);
  }

  factory ServiceRegistry.withServices({
    required BillScanRepository billScanRepository,
    required BillReceiptPicker receiptPicker,
    required RestaurantDiscoveryRepository restaurantRepository,
    required FavoritesRepository favoritesRepository,
    required ProfileManagementRepository profileRepository,
    required Future<bool> Function() ensureAuthenticated,
    required Future<void> Function() onAuthenticationRequired,
    required bool Function() isSignedIn,
  }) {
    return ServiceRegistry([
      ServiceRegistryEntry(
        id: TrustBiteServiceId.billScan,
        shortcutLabel: 'Quét bill',
        requiresAuthentication: true,
        pageBuilder: (_) => BillScanPage(
          repository: billScanRepository,
          receiptPicker: receiptPicker,
          ensureAuthenticated: ensureAuthenticated,
          onAuthenticationRequired: onAuthenticationRequired,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.nearby,
        shortcutLabel: 'Gần quán',
        requiresAuthentication: false,
        pageBuilder: (_) => NearbyServicePage(
          isSignedIn: isSignedIn(),
          onLogin: ensureAuthenticated,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.summary,
        shortcutLabel: 'Tóm tắt',
        requiresAuthentication: false,
        pageBuilder: (_) => SummaryServicePage(
          restaurantRepository: restaurantRepository,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.compare,
        shortcutLabel: 'So sánh',
        requiresAuthentication: false,
        pageBuilder: (_) => CompareServicePage(
          restaurantRepository: restaurantRepository,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.saveRestaurant,
        shortcutLabel: 'Lưu quán',
        requiresAuthentication: true,
        pageBuilder: (_) => SaveRestaurantServicePage(
          onLogin: ensureAuthenticated,
          onAuthenticationRequired: onAuthenticationRequired,
          favoritesRepository: favoritesRepository,
          restaurantRepository: restaurantRepository,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.reportFake,
        shortcutLabel: 'Báo ảo',
        requiresAuthentication: true,
        pageBuilder: (_) => ReportFakeServicePage(
          restaurantRepository: restaurantRepository,
          reportRepository: profileRepository,
          onAuthenticationRequired: onAuthenticationRequired,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.dishSearch,
        shortcutLabel: 'Tìm món',
        requiresAuthentication: false,
        pageBuilder: (_) => DishSearchServicePage(
          restaurantRepository: restaurantRepository,
        ),
      ),
      ServiceRegistryEntry(
        id: TrustBiteServiceId.recommendations,
        shortcutLabel: 'Gợi ý',
        requiresAuthentication: false,
        pageBuilder: (_) => RecommendationsServicePage(
          restaurantRepository: restaurantRepository,
        ),
      ),
    ]);
  }

  final Map<String, ServiceRegistryEntry> _entries;

  ServiceRegistryEntry? entryForShortcut(String shortcutLabel) {
    return _entries[shortcutLabel];
  }

  Future<bool> open(
    BuildContext context,
    String shortcutLabel, {
    required Future<bool> Function() ensureAuthenticated,
  }) async {
    final entry = entryForShortcut(shortcutLabel);
    if (entry == null) return false;
    if (entry.requiresAuthentication && !await ensureAuthenticated()) {
      return true;
    }
    if (!context.mounted) return true;
    await Navigator.of(
      context,
    ).push<void>(MaterialPageRoute<void>(builder: entry.pageBuilder));
    return true;
  }
}
