import 'package:flutter/foundation.dart';

class MobileRuntimeConfig {
  const MobileRuntimeConfig({
    required this.apiBaseUrl,
    required this.awsRegion,
    required this.cognitoUserPoolId,
    required this.cognitoClientId,
    this.locationMapApiKey = '',
    this.locationMapName = 'TrustBiteMap',
  });

  factory MobileRuntimeConfig.fromEnvironment() {
    const configuredApiBaseUrl =
        String.fromEnvironment('TRUSTBITE_API_BASE_URL');

    return MobileRuntimeConfig(
      apiBaseUrl: configuredApiBaseUrl.isEmpty
          ? _defaultApiBaseUrl()
          : configuredApiBaseUrl,
      awsRegion: const String.fromEnvironment(
        'TRUSTBITE_AWS_REGION',
        defaultValue: 'ap-southeast-1',
      ),
      cognitoUserPoolId:
          const String.fromEnvironment('TRUSTBITE_COGNITO_USER_POOL_ID'),
      cognitoClientId:
          const String.fromEnvironment('TRUSTBITE_COGNITO_CLIENT_ID'),
      locationMapApiKey:
          const String.fromEnvironment('TRUSTBITE_LOCATION_MAP_API_KEY'),
      locationMapName: const String.fromEnvironment(
        'TRUSTBITE_LOCATION_MAP_NAME',
        defaultValue: 'TrustBiteMap',
      ),
    );
  }

  final String apiBaseUrl;
  final String awsRegion;
  final String cognitoUserPoolId;
  final String cognitoClientId;
  final String locationMapApiKey;
  final String locationMapName;

  bool get hasCognitoConfig =>
      awsRegion.trim().isNotEmpty &&
      cognitoUserPoolId.trim().isNotEmpty &&
      cognitoClientId.trim().isNotEmpty;

  bool get hasLocationMapConfig =>
      awsRegion.trim().isNotEmpty &&
      locationMapName.trim().isNotEmpty &&
      locationMapApiKey.trim().isNotEmpty;

  Uri? get locationMapStyleUri {
    if (!hasLocationMapConfig) return null;

    return Uri.https(
      'maps.geo.${awsRegion.trim()}.amazonaws.com',
      '/maps/v0/maps/${locationMapName.trim()}/style-descriptor',
      {'key': locationMapApiKey.trim()},
    );
  }

  Uri apiUri(String path, [Map<String, String?>? queryParameters]) {
    final base = _apiV1BaseUri();
    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    final filteredQuery = <String, String>{};
    for (final entry in (queryParameters ?? {}).entries) {
      final value = entry.value;
      if (value != null) {
        filteredQuery[entry.key] = value;
      }
    }

    return base.replace(
      pathSegments: [
        ...base.pathSegments,
        ...Uri.parse(normalizedPath).pathSegments,
      ],
      queryParameters: filteredQuery.isEmpty ? null : filteredQuery,
    );
  }

  Uri _apiV1BaseUri() {
    final parsed = Uri.parse(apiBaseUrl);
    final segments =
        parsed.pathSegments.where((segment) => segment.isNotEmpty).toList();
    final alreadyNamespaced = segments.length >= 2 &&
        segments[segments.length - 2] == 'api' &&
        segments.last == 'v1';

    return parsed.replace(
      pathSegments: alreadyNamespaced ? segments : [...segments, 'api', 'v1'],
      queryParameters: null,
    );
  }
}

String _defaultApiBaseUrl() {
  if (defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:5000';
  }

  return 'http://localhost:5000';
}
