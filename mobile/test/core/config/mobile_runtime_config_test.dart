import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

void main() {
  group('MobileRuntimeConfig', () {
    test('builds API v1 URI without duplicating namespace', () {
      const config = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000/api/v1/',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: 'pool-id',
        cognitoClientId: 'client-id',
      );

      expect(
        config.apiUri('/users/me').toString(),
        'http://localhost:5000/api/v1/users/me',
      );
    });

    test('adds API v1 namespace and omits null query values', () {
      const config = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: '',
        cognitoClientId: '',
      );

      expect(
        config.apiUri('/restaurants/nearby', {
          'lat': '21.03',
          'lng': '105.85',
          'radiusMeters': null,
        }).toString(),
        'http://localhost:5000/api/v1/restaurants/nearby?lat=21.03&lng=105.85',
      );
    });

    test('requires region, pool, and client before auth UI can be enabled', () {
      const missingRegion = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: '',
        cognitoUserPoolId: 'pool-id',
        cognitoClientId: 'client-id',
      );

      const missingClient = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: 'pool-id',
        cognitoClientId: '',
      );

      const ready = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: 'pool-id',
        cognitoClientId: 'client-id',
      );

      expect(missingRegion.hasCognitoConfig, isFalse);
      expect(missingClient.hasCognitoConfig, isFalse);
      expect(ready.hasCognitoConfig, isTrue);
    });
  });
}
