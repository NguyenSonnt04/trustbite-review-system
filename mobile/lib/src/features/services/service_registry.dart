import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_page.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';

enum TrustBiteServiceId { billScan, nearby, summary, compare, saveRestaurant }

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
