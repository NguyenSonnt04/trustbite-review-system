import 'dart:math';

import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';

abstract interface class BillScanRepository {
  Future<List<BillScanRestaurant>> fetchRestaurants();

  Future<List<BillScanBranch>> fetchBranches(String restaurantId);

  Future<BillScanResult> submitScan({
    required String restaurantId,
    required String branchId,
    required BillReceiptFile receipt,
  });

  Future<BillScanResult> fetchScan(String scanId);
}

class ApiBillScanRepository implements BillScanRepository {
  ApiBillScanRepository({
    required TrustBiteApiClient apiClient,
    required RestaurantDiscoveryRepository restaurantRepository,
    String Function()? idempotencyKeyFactory,
  }) : _apiClient = apiClient,
       _restaurantRepository = restaurantRepository,
       _idempotencyKeyFactory = idempotencyKeyFactory ?? _generateUuidV4;

  final TrustBiteApiClient _apiClient;
  final RestaurantDiscoveryRepository _restaurantRepository;
  final String Function() _idempotencyKeyFactory;

  @override
  Future<List<BillScanRestaurant>> fetchRestaurants() async {
    final restaurants = await _restaurantRepository.fetchRestaurants();
    return restaurants
        .where((restaurant) => restaurant.id?.trim().isNotEmpty == true)
        .map(
          (restaurant) => BillScanRestaurant(
            id: restaurant.id!.trim(),
            name: restaurant.name.trim(),
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<List<BillScanBranch>> fetchBranches(String restaurantId) async {
    final normalizedId = _requiredInput(restaurantId, 'restaurantId');
    final response = await _apiClient.getJson(
      '/restaurants/$normalizedId/branches',
    );
    final items = response['items'];
    if (items is! List) {
      throw const FormatException('Branch list items must be an array.');
    }
    return items
        .map((item) => _parseBranch(item, normalizedId))
        .toList(growable: false);
  }

  @override
  Future<BillScanResult> submitScan({
    required String restaurantId,
    required String branchId,
    required BillReceiptFile receipt,
  }) async {
    final normalizedRestaurantId = _requiredInput(restaurantId, 'restaurantId');
    final normalizedBranchId = _requiredInput(branchId, 'branchId');
    _validateReceipt(receipt);

    final response = await _apiClient.postMultipart(
      '/bill-scans',
      fields: {
        'restaurantId': normalizedRestaurantId,
        'branchId': normalizedBranchId,
      },
      file: ApiMultipartFile(
        fieldName: 'receiptImage',
        fileName: receipt.fileName,
        contentType: receipt.contentType,
        bytes: receipt.bytes,
      ),
      headers: {'Idempotency-Key': _idempotencyKeyFactory()},
    );
    return _parseResult(response);
  }

  @override
  Future<BillScanResult> fetchScan(String scanId) async {
    final normalizedId = _requiredInput(scanId, 'scanId');
    return _parseResult(await _apiClient.getJson('/bill-scans/$normalizedId'));
  }

  static BillScanBranch _parseBranch(
    Object? value,
    String expectedRestaurantId,
  ) {
    final map = _requiredMap(value, 'Branch');
    final restaurantId = _requiredString(
      map['restaurantId'],
      'Branch restaurantId',
    );
    if (restaurantId != expectedRestaurantId) {
      throw const FormatException(
        'Branch does not belong to the selected restaurant.',
      );
    }
    final address = _requiredString(map['address'], 'Branch address');
    return BillScanBranch(
      id: _requiredString(map['id'], 'Branch id'),
      restaurantId: restaurantId,
      name: _requiredString(map['name'], 'Branch name'),
      address: address,
      area: _optionalString(map['area']) ?? _deriveArea(address),
    );
  }

  static BillScanResult _parseResult(Map<String, dynamic> response) {
    final rawItems = response['items'] ?? response['lineItems'];
    if (rawItems is! List) {
      throw const FormatException('Bill scan items must be an array.');
    }
    final overallResult = _requiredString(
      response['overallResult'] ?? response['overallStatus'],
      'Bill scan overall result',
    );
    if (!const {
      'MATCHED',
      'PRICE_MISMATCH',
      'INCONCLUSIVE',
    }.contains(overallResult)) {
      throw const FormatException('Bill scan overall result is invalid.');
    }

    final restaurant = _optionalMap(response['restaurant']);
    final branch = _optionalMap(response['branch']);
    return BillScanResult(
      scanId: _requiredString(
        response['scanId'] ?? response['id'],
        'Bill scan id',
      ),
      restaurantId: _requiredString(
        response['restaurantId'] ?? restaurant?['id'],
        'Bill scan restaurantId',
      ),
      branchId: _requiredString(
        response['branchId'] ?? branch?['id'],
        'Bill scan branchId',
      ),
      overallResult: overallResult,
      items: rawItems.map(_parseLineItem).toList(growable: false),
    );
  }

  static BillScanLineItem _parseLineItem(Object? value) {
    final map = _requiredMap(value, 'Bill scan line item');
    final result = _requiredString(
      map['result'] ?? map['status'],
      'Line item result',
    );
    if (!const {'MATCHED', 'PRICE_MISMATCH', 'INCONCLUSIVE'}.contains(result)) {
      throw const FormatException('Line item result is invalid.');
    }

    final menuItem = _optionalMap(map['menuItem']);
    return BillScanLineItem(
      observedName: _requiredString(
        map['observedName'] ?? map['rawName'] ?? map['name'],
        'Line item observed name',
      ),
      matchedName: _optionalString(
        map['matchedName'] ??
            map['matchedMenuItemName'] ??
            map['expectedName'] ??
            menuItem?['name'],
      ),
      observedUnitPrice: _optionalNumber(
        map['observedUnitPrice'] ?? map['observedPrice'],
        'Line item observed price',
      ),
      expectedUnitPrice: _optionalNumber(
        map['expectedUnitPrice'] ?? map['expectedPrice'],
        'Line item expected price',
      ),
      priceDifference: _optionalNumber(
        map['priceDifference'] ?? map['difference'],
        'Line item price difference',
      ),
      confidence: _optionalNumber(
        map['confidence'] ?? map['matchConfidence'] ?? map['mappingConfidence'],
        'Line item confidence',
      )?.toDouble(),
      result: result,
    );
  }

  static void _validateReceipt(BillReceiptFile receipt) {
    if (receipt.bytes.isEmpty) {
      throw const FormatException('Ảnh bill không được để trống.');
    }
    if (receipt.bytes.length > 10 * 1024 * 1024) {
      throw const FormatException('Ảnh bill không được vượt quá 10 MB.');
    }
    if (!const {'image/jpeg', 'image/png'}.contains(receipt.contentType)) {
      throw const FormatException('Chỉ hỗ trợ ảnh JPG hoặc PNG.');
    }
  }

  static String _requiredInput(String value, String field) {
    final normalized = value.trim();
    if (normalized.isEmpty) throw FormatException('$field is required.');
    return normalized;
  }

  static Map<String, dynamic> _requiredMap(Object? value, String field) {
    if (value is! Map<String, dynamic>) {
      throw FormatException('$field must be an object.');
    }
    return value;
  }

  static Map<String, dynamic>? _optionalMap(Object? value) {
    if (value == null) return null;
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Backend object field is invalid.');
    }
    return value;
  }

  static String _requiredString(Object? value, String field) {
    final normalized = _optionalString(value);
    if (normalized == null) throw FormatException('$field is required.');
    return normalized;
  }

  static String? _optionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Backend text field is invalid.');
    }
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }

  static num? _optionalNumber(Object? value, String field) {
    if (value == null) return null;
    if (value is! num || !value.isFinite) {
      throw FormatException('$field is invalid.');
    }
    return value;
  }

  static String _deriveArea(String address) {
    final parts = address
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList(growable: false);
    if (parts.length <= 1) return address;
    return parts.skip(1).join(', ');
  }

  static String _generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}
