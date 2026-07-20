import 'package:image_picker/image_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';

enum BillReceiptSource { camera, gallery }

abstract interface class BillReceiptPicker {
  Future<BillReceiptFile?> pick(BillReceiptSource source);
}

class ImagePickerBillReceiptPicker implements BillReceiptPicker {
  ImagePickerBillReceiptPicker({ImagePicker? imagePicker})
    : _imagePicker = imagePicker ?? ImagePicker();

  final ImagePicker _imagePicker;

  @override
  Future<BillReceiptFile?> pick(BillReceiptSource source) async {
    final image = await _imagePicker.pickImage(
      source: source == BillReceiptSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 90,
      maxWidth: 2400,
    );
    if (image == null) return null;

    final extension = image.name.split('.').last.toLowerCase();
    final contentType = switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      _ => throw const FormatException('Chỉ hỗ trợ ảnh JPG hoặc PNG.'),
    };
    return BillReceiptFile(
      fileName: image.name,
      contentType: contentType,
      bytes: await image.readAsBytes(),
    );
  }
}
