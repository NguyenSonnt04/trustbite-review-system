import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_page.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_result_page.dart';

void main() {
  testWidgets('loads restaurants, selects a branch and opens scan result', (
    tester,
  ) async {
    final restaurantCompleter = Completer<List<BillScanRestaurant>>();
    final submitCompleter = Completer<BillScanResult>();
    final repository = _FakeBillScanRepository(
      restaurantResponses: [restaurantCompleter.future],
      branches: const [
        BillScanBranch(
          id: 'branch-1',
          restaurantId: 'restaurant-1',
          name: 'Chi nhánh Nguyễn Huệ',
          address: '12 Nguyễn Huệ, Quận 1',
          area: 'Quận 1, TP. Hồ Chí Minh',
        ),
      ],
      submitFuture: submitCompleter.future,
    );
    var authChecks = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: BillScanPage(
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(
            BillReceiptFile(
              fileName: 'bill.png',
              contentType: 'image/png',
              bytes: [137, 80, 78, 71, 1, 2, 3],
            ),
          ),
          ensureAuthenticated: () async {
            authChecks += 1;
            return true;
          },
          onAuthenticationRequired: () async {},
        ),
      ),
    );

    expect(
      find.byKey(const ValueKey('bill-restaurants-loading')),
      findsOneWidget,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('bill-submit-button')),
          )
          .onPressed,
      isNull,
    );

    restaurantCompleter.complete(const [
      BillScanRestaurant(id: 'restaurant-1', name: 'Phở TrustBite'),
    ]);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('bill-restaurant-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phở TrustBite').last);
    await tester.pumpAndSettle();

    expect(find.text('Chi nhánh Nguyễn Huệ'), findsOneWidget);
    expect(find.text('12 Nguyễn Huệ, Quận 1'), findsOneWidget);
    expect(find.text('Quận 1, TP. Hồ Chí Minh'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('bill-branch-branch-1')));
    await tester.ensureVisible(
      find.byKey(const ValueKey('bill-gallery-button')),
    );
    await tester.tap(find.byKey(const ValueKey('bill-gallery-button')));
    await tester.pumpAndSettle();

    expect(find.text('bill.png'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('bill-submit-button')),
      250,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('bill-submit-button')),
          )
          .onPressed,
      isNotNull,
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('bill-submit-button')),
    );
    await tester.tap(find.byKey(const ValueKey('bill-submit-button')));
    await tester.pump();
    expect(find.text('Đang đối chiếu...'), findsOneWidget);
    expect(authChecks, 1);

    submitCompleter.complete(_matchedResult);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('bill-scan-result-page')), findsOneWidget);
    expect(find.text('Giá các món khớp'), findsOneWidget);
    expect(repository.submittedBranchId, 'branch-1');
  });

  testWidgets('shows restaurant error and retries', (tester) async {
    final failedRequest = Completer<List<BillScanRestaurant>>();
    final repository = _FakeBillScanRepository(
      restaurantResponses: [
        failedRequest.future,
        Future.value(const [
          BillScanRestaurant(id: 'restaurant-1', name: 'Bún bò tải lại'),
        ]),
      ],
      branches: const [],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: BillScanPage(
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(null),
          ensureAuthenticated: () async => true,
          onAuthenticationRequired: () async {},
        ),
      ),
    );
    failedRequest.completeError(Exception('offline'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('bill-restaurants-error')),
      findsOneWidget,
    );
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('bill-restaurant-picker')),
      findsOneWidget,
    );
    expect(repository.restaurantCalls, 2);
  });

  testWidgets('renders item values, unmatched items and scope note', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: BillScanResultPage(result: _mismatchResult)),
    );

    expect(find.text('Có món lệch giá'), findsOneWidget);
    expect(find.text('Phở tái'), findsOneWidget);
    expect(find.text('70.000 ₫'), findsOneWidget);
    expect(find.text('65.000 ₫'), findsOneWidget);
    expect(find.text('5.000 ₫'), findsOneWidget);
    expect(find.text('94%'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('bill-unmatched-items')),
      250,
    );
    expect(find.text('• Khăn lạnh'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('bill-scan-scope-note')),
      250,
    );
    expect(
      find.textContaining('Phí dịch vụ, thuế, giảm giá và tổng bill'),
      findsOneWidget,
    );
  });

  testWidgets('clears authentication after an expired submit before retrying', (
    tester,
  ) async {
    final repository = _FakeBillScanRepository(
      restaurantResponses: [
        Future.value(const [
          BillScanRestaurant(id: 'restaurant-1', name: 'Phở TrustBite'),
        ]),
      ],
      branches: const [
        BillScanBranch(
          id: 'branch-1',
          restaurantId: 'restaurant-1',
          name: 'Chi nhánh Nguyễn Huệ',
          address: '12 Nguyễn Huệ, Quận 1',
          area: 'Quận 1',
        ),
      ],
      authRequiredOnSubmit: true,
    );
    var authenticated = true;
    var authChecks = 0;
    var authExpiredCalls = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: BillScanPage(
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(
            BillReceiptFile(
              fileName: 'bill.jpg',
              contentType: 'image/jpeg',
              bytes: [255, 216, 255, 224],
            ),
          ),
          ensureAuthenticated: () async {
            authChecks += 1;
            return authenticated;
          },
          onAuthenticationRequired: () async {
            authExpiredCalls += 1;
            authenticated = false;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('bill-restaurant-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phở TrustBite').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('bill-branch-branch-1')));
    await tester.ensureVisible(
      find.byKey(const ValueKey('bill-gallery-button')),
    );
    await tester.tap(find.byKey(const ValueKey('bill-gallery-button')));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('bill-submit-button')),
      250,
    );

    await tester.tap(find.byKey(const ValueKey('bill-submit-button')));
    await tester.pumpAndSettle();

    expect(authExpiredCalls, 1);
    expect(repository.submitCalls, 1);
    expect(
      find.text('Phiên đăng nhập đã hết hạn. Vui lòng thử lại.'),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('bill-submit-button')));
    await tester.pumpAndSettle();

    expect(authChecks, 2);
    expect(repository.submitCalls, 1);
    expect(
      find.text('Vui lòng đăng nhập để tiếp tục quét bill.'),
      findsOneWidget,
    );
  });
}

const _matchedResult = BillScanResult(
  scanId: 'scan-1',
  restaurantId: 'restaurant-1',
  branchId: 'branch-1',
  overallResult: 'MATCHED',
  items: [
    BillScanLineItem(
      observedName: 'Phở bò',
      matchedName: 'Phở bò',
      observedUnitPrice: 65000,
      expectedUnitPrice: 65000,
      priceDifference: 0,
      confidence: 0.98,
      result: 'MATCHED',
    ),
  ],
);

const _mismatchResult = BillScanResult(
  scanId: 'scan-2',
  restaurantId: 'restaurant-1',
  branchId: 'branch-1',
  overallResult: 'PRICE_MISMATCH',
  items: [
    BillScanLineItem(
      observedName: 'Phở tái',
      matchedName: 'Phở bò tái',
      observedUnitPrice: 70000,
      expectedUnitPrice: 65000,
      priceDifference: 5000,
      confidence: 0.94,
      result: 'PRICE_MISMATCH',
    ),
    BillScanLineItem(
      observedName: 'Khăn lạnh',
      matchedName: null,
      observedUnitPrice: 3000,
      expectedUnitPrice: null,
      priceDifference: null,
      confidence: 0.31,
      result: 'INCONCLUSIVE',
    ),
  ],
);

class _FakeReceiptPicker implements BillReceiptPicker {
  const _FakeReceiptPicker(this.receipt);

  final BillReceiptFile? receipt;

  @override
  Future<BillReceiptFile?> pick(BillReceiptSource source) async => receipt;
}

class _FakeBillScanRepository implements BillScanRepository {
  _FakeBillScanRepository({
    required this.restaurantResponses,
    required this.branches,
    this.submitFuture,
    this.authRequiredOnSubmit = false,
  });

  final List<Future<List<BillScanRestaurant>>> restaurantResponses;
  final List<BillScanBranch> branches;
  final Future<BillScanResult>? submitFuture;
  final bool authRequiredOnSubmit;
  int restaurantCalls = 0;
  int submitCalls = 0;
  String? submittedBranchId;

  @override
  Future<List<BillScanRestaurant>> fetchRestaurants() {
    final response = restaurantResponses[restaurantCalls];
    restaurantCalls += 1;
    return response;
  }

  @override
  Future<List<BillScanBranch>> fetchBranches(String restaurantId) async {
    return branches;
  }

  @override
  Future<BillScanResult> fetchScan(String scanId) async => _matchedResult;

  @override
  Future<BillScanResult> submitScan({
    required String restaurantId,
    required String branchId,
    required BillReceiptFile receipt,
  }) async {
    submitCalls += 1;
    submittedBranchId = branchId;
    if (authRequiredOnSubmit) {
      throw const AuthRequiredException(401, 'expired');
    }
    return submitFuture == null ? _matchedResult : await submitFuture!;
  }
}
