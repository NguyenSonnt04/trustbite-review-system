class MobileRuntimeConfig {
  const MobileRuntimeConfig({
    required this.apiBaseUrl,
    required this.awsRegion,
    required this.cognitoUserPoolId,
    required this.cognitoClientId,
  });

  final String apiBaseUrl;
  final String awsRegion;
  final String cognitoUserPoolId;
  final String cognitoClientId;

  bool get hasCognitoConfig =>
      awsRegion.trim().isNotEmpty &&
      cognitoUserPoolId.trim().isNotEmpty &&
      cognitoClientId.trim().isNotEmpty;

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
    final segments = parsed.pathSegments
        .where((segment) => segment.isNotEmpty)
        .toList();
    final alreadyNamespaced = segments.length >= 2 &&
        segments[segments.length - 2] == 'api' &&
        segments.last == 'v1';

    return parsed.replace(
      pathSegments: alreadyNamespaced ? segments : [...segments, 'api', 'v1'],
      queryParameters: null,
      fragment: '',
    );
  }
}
