import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';
import 'package:trustbite_mobile/src/features/services/service_registry.dart';

void main() {
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
