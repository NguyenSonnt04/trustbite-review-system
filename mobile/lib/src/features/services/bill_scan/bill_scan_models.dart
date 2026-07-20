class BillScanRestaurant {
  const BillScanRestaurant({required this.id, required this.name});

  final String id;
  final String name;
}

class BillScanBranch {
  const BillScanBranch({
    required this.id,
    required this.restaurantId,
    required this.name,
    required this.address,
    required this.area,
  });

  final String id;
  final String restaurantId;
  final String name;
  final String address;
  final String area;
}

class BillReceiptFile {
  const BillReceiptFile({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final List<int> bytes;
}

class BillScanLineItem {
  const BillScanLineItem({
    required this.observedName,
    required this.matchedName,
    required this.observedUnitPrice,
    required this.expectedUnitPrice,
    required this.priceDifference,
    required this.confidence,
    required this.result,
  });

  final String observedName;
  final String? matchedName;
  final num? observedUnitPrice;
  final num? expectedUnitPrice;
  final num? priceDifference;
  final double? confidence;
  final String result;

  bool get isUnmatched => matchedName == null || result == 'INCONCLUSIVE';
}

class BillScanResult {
  const BillScanResult({
    required this.scanId,
    required this.restaurantId,
    required this.branchId,
    required this.overallResult,
    required this.items,
  });

  final String scanId;
  final String restaurantId;
  final String branchId;
  final String overallResult;
  final List<BillScanLineItem> items;
}
