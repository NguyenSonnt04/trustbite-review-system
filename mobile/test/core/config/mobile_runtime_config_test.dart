import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

void main() {
  group('MobileRuntimeConfig', () {
    test('loads local defaults from compile-time environment', () {
      final config = MobileRuntimeConfig.fromEnvironment();

      expect(config.apiBaseUrl, 'http://10.0.2.2:5000');
      expect(config.awsRegion, 'ap-southeast-1');
      expect(config.cognitoUserPoolId, '');
      expect(config.cognitoClientId, '');
      expect(config.locationMapApiKey, '');
      expect(config.locationMapName, 'TrustBiteMap');
    });

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
          'northEastLat': '21.05',
          'northEastLng': '105.90',
          'southWestLat': '21.01',
          'southWestLng': '105.80',
          'page': null,
        }).toString(),
        'http://localhost:5000/api/v1/restaurants/nearby'
        '?northEastLat=21.05&northEastLng=105.90'
        '&southWestLat=21.01&southWestLng=105.80',
      );
    });

    test('builds the AWS Location map style URL from runtime values', () {
      const config = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: '',
        cognitoClientId: '',
        locationMapApiKey: 'key with symbols/+',
        locationMapName: 'TrustBite Map',
      );

      expect(config.hasLocationMapConfig, isTrue);
      expect(
        config.locationMapStyleUri.toString(),
        'https://maps.geo.ap-southeast-1.amazonaws.com/maps/v0/maps/'
        'TrustBite%20Map/style-descriptor?key=key+with+symbols%2F%2B',
      );
    });

    test('does not create a map style URL without an API key', () {
      const config = MobileRuntimeConfig(
        apiBaseUrl: 'http://localhost:5000',
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: '',
        cognitoClientId: '',
      );
      expect(config.hasLocationMapConfig, isFalse);
      expect(config.locationMapStyleUri, isNull);
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
