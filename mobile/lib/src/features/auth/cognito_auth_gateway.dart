import 'dart:convert';

import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

enum CognitoAuthStep {
  signedIn,
  confirmSignUp,
  confirmSmsMfa,
  confirmTotpMfa,
  confirmEmailMfa,
  confirmNewPassword,
}

class CognitoAuthResult {
  const CognitoAuthResult(this.step, {this.destination});

  const CognitoAuthResult.signedIn() : this(CognitoAuthStep.signedIn);

  final CognitoAuthStep step;
  final String? destination;

  bool get isSignedIn => step == CognitoAuthStep.signedIn;
}

abstract interface class CognitoAuthGateway implements CognitoSessionProvider {
  Future<CognitoAuthResult> signIn({
    required String identifier,
    required String password,
  });

  Future<CognitoAuthResult> signUp({
    required String identifier,
    required String password,
  });

  Future<CognitoAuthResult> confirmSignIn(String confirmationValue);

  Future<void> confirmSignUp({
    required String identifier,
    required String confirmationCode,
  });
}

class CognitoAuthGatewayException implements Exception {
  const CognitoAuthGatewayException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AmplifyCognitoAuthGateway implements CognitoAuthGateway {
  AmplifyCognitoAuthGateway({required MobileRuntimeConfig config})
    : _config = config;

  final MobileRuntimeConfig _config;
  Future<void>? _configuration;

  @override
  Future<void> initialize() {
    if (!_config.hasCognitoConfig) {
      throw const CognitoAuthGatewayException(
        'Cognito chưa được cấu hình cho ứng dụng.',
      );
    }

    return _configuration ??= _configureAmplify();
  }

  Future<void> _configureAmplify() async {
    if (Amplify.isConfigured) return;

    await Amplify.addPlugin(AmplifyAuthCognito());
    await Amplify.configure(buildAmplifyConfigurationJson());
  }

  String buildAmplifyConfigurationJson() => jsonEncode({
    'Version': '1.0',
    'auth': {
      'plugins': {
        'awsCognitoAuthPlugin': {
          'Version': '1.0',
          'CognitoUserPool': {
            'Default': {
              'PoolId': _config.cognitoUserPoolId.trim(),
              'AppClientId': _config.cognitoClientId.trim(),
              'Region': _config.awsRegion.trim(),
            },
          },
        },
      },
    },
  });

  @override
  Future<CognitoAuthResult> signIn({
    required String identifier,
    required String password,
  }) async {
    final normalizedIdentifier = _validateCredentials(identifier, password);

    try {
      await initialize();
      final result = await Amplify.Auth.signIn(
        username: normalizedIdentifier,
        password: password,
      );
      return _mapSignInResult(result);
    } on CognitoAuthGatewayException {
      rethrow;
    } on AuthException catch (error) {
      throw CognitoAuthGatewayException(_messageForException(error));
    } on Exception {
      throw const CognitoAuthGatewayException(
        'Không thể kết nối với Cognito. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<CognitoAuthResult> signUp({
    required String identifier,
    required String password,
  }) async {
    final normalizedIdentifier = _validateCredentials(identifier, password);

    try {
      await initialize();
      final result = await Amplify.Auth.signUp(
        username: normalizedIdentifier,
        password: password,
        options: SignUpOptions(
          userAttributes: _attributesFor(normalizedIdentifier),
        ),
      );
      if (!result.isSignUpComplete) {
        return CognitoAuthResult(
          CognitoAuthStep.confirmSignUp,
          destination: result.nextStep.codeDeliveryDetails?.destination,
        );
      }
      return signIn(identifier: normalizedIdentifier, password: password);
    } on CognitoAuthGatewayException {
      rethrow;
    } on AuthException catch (error) {
      throw CognitoAuthGatewayException(_messageForException(error));
    } on Exception {
      throw const CognitoAuthGatewayException(
        'Không thể kết nối với Cognito. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<CognitoAuthResult> confirmSignIn(String confirmationValue) async {
    final normalizedValue = confirmationValue.trim();
    if (normalizedValue.isEmpty) {
      throw const CognitoAuthGatewayException(
        'Vui lòng nhập thông tin xác nhận.',
      );
    }

    try {
      await initialize();
      final result = await Amplify.Auth.confirmSignIn(
        confirmationValue: normalizedValue,
      );
      return _mapSignInResult(result);
    } on CognitoAuthGatewayException {
      rethrow;
    } on AuthException catch (error) {
      throw CognitoAuthGatewayException(_messageForException(error));
    } on Exception {
      throw const CognitoAuthGatewayException(
        'Không thể kết nối với Cognito. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<void> confirmSignUp({
    required String identifier,
    required String confirmationCode,
  }) async {
    final normalizedIdentifier = identifier.trim();
    final normalizedCode = confirmationCode.trim();
    if (normalizedIdentifier.isEmpty || normalizedCode.isEmpty) {
      throw const CognitoAuthGatewayException(
        'Vui lòng nhập mã xác nhận đăng ký.',
      );
    }

    try {
      await initialize();
      final result = await Amplify.Auth.confirmSignUp(
        username: normalizedIdentifier,
        confirmationCode: normalizedCode,
      );
      if (!result.isSignUpComplete) {
        throw const CognitoAuthGatewayException(
          'Cognito chưa hoàn tất xác nhận tài khoản.',
        );
      }
    } on CognitoAuthGatewayException {
      rethrow;
    } on AuthException catch (error) {
      throw CognitoAuthGatewayException(_messageForException(error));
    } on Exception {
      throw const CognitoAuthGatewayException(
        'Không thể kết nối với Cognito. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<String?> getAccessToken() async {
    if (!_config.hasCognitoConfig) return null;

    try {
      await initialize();
      final session =
          await Amplify.Auth.fetchAuthSession() as CognitoAuthSession;
      if (!session.isSignedIn) return null;
      final token = session.userPoolTokensResult.value.accessToken.raw.trim();
      return token.isEmpty ? null : token;
    } on Exception {
      return null;
    }
  }

  @override
  Future<bool> isSignedIn() async => (await getAccessToken()) != null;

  @override
  Future<void> signOut() async {
    if (!_config.hasCognitoConfig || !Amplify.isConfigured) return;
    await Amplify.Auth.signOut();
  }

  String _validateCredentials(String identifier, String password) {
    final normalizedIdentifier = identifier.trim();
    if (normalizedIdentifier.isEmpty) {
      throw const CognitoAuthGatewayException(
        'Vui lòng nhập email hoặc số điện thoại.',
      );
    }
    if (password.isEmpty) {
      throw const CognitoAuthGatewayException('Vui lòng nhập mật khẩu.');
    }
    return normalizedIdentifier;
  }

  CognitoAuthResult _mapSignInResult(SignInResult result) {
    if (result.isSignedIn) {
      return const CognitoAuthResult.signedIn();
    }

    final destination = result.nextStep.codeDeliveryDetails?.destination;
    return switch (result.nextStep.signInStep) {
      AuthSignInStep.confirmSignUp => CognitoAuthResult(
        CognitoAuthStep.confirmSignUp,
        destination: destination,
      ),
      AuthSignInStep.confirmSignInWithSmsMfaCode => CognitoAuthResult(
        CognitoAuthStep.confirmSmsMfa,
        destination: destination,
      ),
      AuthSignInStep.confirmSignInWithTotpMfaCode => const CognitoAuthResult(
        CognitoAuthStep.confirmTotpMfa,
      ),
      AuthSignInStep.confirmSignInWithOtpCode => CognitoAuthResult(
        CognitoAuthStep.confirmEmailMfa,
        destination: destination,
      ),
      AuthSignInStep.confirmSignInWithNewPassword => const CognitoAuthResult(
        CognitoAuthStep.confirmNewPassword,
      ),
      _ => throw const CognitoAuthGatewayException(
        'Cognito yêu cầu bước xác thực chưa được ứng dụng hỗ trợ.',
      ),
    };
  }

  Map<AuthUserAttributeKey, String> _attributesFor(String identifier) {
    if (identifier.contains('@')) {
      return {CognitoUserAttributeKey.email: identifier};
    }
    if (identifier.startsWith('+')) {
      return {CognitoUserAttributeKey.phoneNumber: identifier};
    }
    return const {};
  }

  String _messageForException(AuthException error) {
    if (error is AuthNotAuthorizedException || error is UserNotFoundException) {
      return 'Email/số điện thoại hoặc mật khẩu không đúng.';
    }
    if (error is UsernameExistsException) {
      return 'Tài khoản Cognito này đã tồn tại.';
    }
    if (error is CodeMismatchException) {
      return 'Mã xác nhận không đúng.';
    }
    if (error is LimitExceededException) {
      return 'Đã thử quá nhiều lần. Vui lòng thử lại sau.';
    }
    if (error is InvalidPasswordException) {
      return 'Mật khẩu chưa đáp ứng chính sách của Cognito.';
    }
    return 'Cognito không thể hoàn tất xác thực. Vui lòng thử lại.';
  }
}
