import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';

class MobileAuthService {
  const MobileAuthService({
    required TrustBiteApiClient apiClient,
    required AuthSessionStore sessionStore,
  })  : _apiClient = apiClient,
        _sessionStore = sessionStore;

  final TrustBiteApiClient _apiClient;
  final AuthSessionStore _sessionStore;

  Future<Map<String, dynamic>> completeCognitoSignIn({
    required String accessToken,
  }) async {
    final normalizedToken = accessToken.trim();
    if (normalizedToken.isEmpty) {
      throw ArgumentError.value(
          accessToken, 'accessToken', 'must not be blank');
    }

    await _sessionStore
        .write(AuthSession.cognito(accessToken: normalizedToken));

    try {
      return await _apiClient.getJson('/users/me');
    } catch (_) {
      await _sessionStore.clear();
      rethrow;
    }
  }

  Future<Map<String, dynamic>> completeLocalDevelopmentSignUp({
    required String phoneNumber,
    String? displayName,
  }) async {
    final normalizedPhone = phoneNumber.trim();
    if (normalizedPhone.isEmpty) {
      throw ArgumentError.value(
          phoneNumber, 'phoneNumber', 'must not be blank');
    }

    final response = await _apiClient.postJson('/auth/dev/local-signup', {
      'phoneNumber': normalizedPhone,
      if (displayName != null && displayName.trim().isNotEmpty)
        'displayName': displayName.trim(),
    });

    final trustedLocal = response['trustedLocal'];
    if (trustedLocal is! Map<String, dynamic>) {
      throw const ApiException(
          500, 'Backend did not return trusted local auth metadata.');
    }

    final userId = trustedLocal['userId'];
    final subject = trustedLocal['subject'];
    if (userId is! String ||
        userId.trim().isEmpty ||
        subject is! String ||
        subject.trim().isEmpty) {
      throw const ApiException(
          500, 'Backend returned invalid trusted local auth metadata.');
    }

    final phone = trustedLocal['phoneNumber'];
    await _sessionStore.write(
      AuthSession.trustedLocal(
        userId: userId,
        subject: subject,
        phoneNumber: phone is String ? phone : normalizedPhone,
      ),
    );

    try {
      return await _apiClient.getJson('/users/me');
    } catch (_) {
      await _sessionStore.clear();
      rethrow;
    }
  }

  Future<void> signOut() => _sessionStore.clear();
}
