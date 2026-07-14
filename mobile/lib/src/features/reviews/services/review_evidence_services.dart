import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';

abstract class ReceiptImagePicker {
  Future<String?> pickFromCamera();

  Future<String?> pickFromGallery();
}

class DeviceReceiptImagePicker implements ReceiptImagePicker {
  DeviceReceiptImagePicker({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<String?> pickFromCamera() => _pick(ImageSource.camera);

  @override
  Future<String?> pickFromGallery() => _pick(ImageSource.gallery);

  Future<String?> _pick(ImageSource source) async {
    final image = await _picker.pickImage(
      source: source,
      imageQuality: 90,
      maxWidth: 2200,
    );
    return image?.path;
  }
}

abstract class ReviewLocationProvider {
  Future<ReviewLocation> getCurrentLocation();
}

class DeviceReviewLocationProvider implements ReviewLocationProvider {
  @override
  Future<ReviewLocation> getCurrentLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError('Vui lòng bật dịch vụ vị trí để xác minh đánh giá.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw StateError('Bạn cần cấp quyền vị trí để gửi đánh giá.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw StateError(
        'Quyền vị trí đã bị từ chối vĩnh viễn. Hãy bật lại trong cài đặt.',
      );
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
    if (position.accuracy <= 0) {
      throw StateError('Không thể xác định độ chính xác GPS.');
    }
    return ReviewLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
    );
  }
}
