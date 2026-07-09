import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';

class MobileAuthService {
  const MobileAuthService({
    required TrustBiteApiClient apiClient,
    required AuthSessionStore sessionStore,
    required CognitoSessionProvider cognitoSessionProvider,
  }) : _apiClient = apiClient,
       _sessionStore = sessionStore,
       _cognitoSessionProvider = cognitoSessionProvider;

  final TrustBiteApiClient _apiClient;
  final AuthSessionStore _sessionStore;
  final CognitoSessionProvider _cognitoSessionProvider;

  Future<Map<String, dynamic>> completeCognitoSignIn() async {
    await _sessionStore.clear();
    return _apiClient.getJson('/users/me');
  }

  Future<Map<String, dynamic>> completeLocalDevelopmentSignUp({
    required String phoneNumber,
    String? displayName,
  }) async {
    final normalizedPhone = phoneNumber.trim();
    if (normalizedPhone.isEmpty) {
      throw ArgumentError.value(
        phoneNumber,
        'phoneNumber',
        'must not be blank',
      );
    }

    final response = await _apiClient.postJson('/auth/dev/local-signup', {
      'phoneNumber': normalizedPhone,
      if (displayName != null && displayName.trim().isNotEmpty)
        'displayName': displayName.trim(),
    });

    final trustedLocal = response['trustedLocal'];
    if (trustedLocal is! Map<String, dynamic>) {
      throw const ApiException(
        500,
        'Backend did not return trusted local auth metadata.',
      );
    }

    final userId = trustedLocal['userId'];
    final subject = trustedLocal['subject'];
    if (userId is! String ||
        userId.trim().isEmpty ||
        subject is! String ||
        subject.trim().isEmpty) {
      throw const ApiException(
        500,
        'Backend returned invalid trusted local auth metadata.',
      );
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

  Future<void> signOut() async {
    await _sessionStore.clear();
    await _cognitoSessionProvider.signOut();
  }
}
