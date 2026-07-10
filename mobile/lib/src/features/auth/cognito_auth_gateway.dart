import 'dart:convert';

import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

enum CognitoAuthStep {
  signedIn,
  confirmOtp,
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
  Future<CognitoAuthResult> requestOtp({required String identifier});

  Future<CognitoAuthResult> confirmOtp(String confirmationValue);
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
  Future<CognitoAuthResult> requestOtp({required String identifier}) async {
    final normalizedIdentifier = _validateIdentifier(identifier);

    try {
      await initialize();
      final result = await Amplify.Auth.signIn(
        username: normalizedIdentifier,
        options: const SignInOptions(
          pluginOptions: CognitoSignInPluginOptions(
            authFlowType: AuthenticationFlowType.customAuthWithoutSrp,
          ),
        ),
      );
      return _mapSignInResult(result);
    } on CognitoAuthGatewayException {
      rethrow;
    } on AuthException catch (error) {
      _logAuthException('requestOtp', error);
      throw CognitoAuthGatewayException(_messageForException(error));
    } on Exception {
      throw const CognitoAuthGatewayException(
        'Không thể kết nối với Cognito. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<CognitoAuthResult> confirmOtp(String confirmationValue) async {
    final normalizedValue = confirmationValue.trim();
    if (normalizedValue.isEmpty) {
      throw const CognitoAuthGatewayException('Vui lòng nhập mã xác nhận.');
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
      _logAuthException('confirmOtp', error);
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

  String _validateIdentifier(String identifier) {
    final normalizedIdentifier = _normalizeEmailIdentifier(identifier);
    if (normalizedIdentifier.isEmpty) {
      throw const CognitoAuthGatewayException('Vui lòng nhập email.');
    }
    return normalizedIdentifier;
  }

  String _normalizeEmailIdentifier(String identifier) {
    final normalized = identifier.trim().toLowerCase();
    if (normalized.isEmpty) return '';
    final isEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(normalized);
    if (!isEmail) {
      throw const CognitoAuthGatewayException('Vui lòng nhập email hợp lệ.');
    }
    return normalized;
  }

  CognitoAuthResult _mapSignInResult(SignInResult result) {
    if (result.isSignedIn) {
      return const CognitoAuthResult.signedIn();
    }

    final destination = result.nextStep.codeDeliveryDetails?.destination;
    return switch (result.nextStep.signInStep) {
      AuthSignInStep.confirmSignInWithCustomChallenge => CognitoAuthResult(
        CognitoAuthStep.confirmOtp,
        destination: destination,
      ),
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

  void _logAuthException(String operation, AuthException error) {
    if (!kDebugMode) return;

    final recoverySuggestion = error.recoverySuggestion?.trim();
    final sanitizedMessage = _sanitizeAuthLog(error.message);
    final sanitizedRecovery =
        recoverySuggestion == null || recoverySuggestion.isEmpty
        ? null
        : _sanitizeAuthLog(recoverySuggestion);

    debugPrint(
      'Cognito auth error during $operation: '
      '${error.runtimeType}: $sanitizedMessage',
    );
    if (sanitizedRecovery != null) {
      debugPrint('Cognito recovery suggestion: $sanitizedRecovery');
    }
  }

  String _sanitizeAuthLog(String value) {
    return value
        .replaceAll(
          RegExp(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
          '[email]',
        )
        .replaceAll(RegExp(r'\+?\d[\d\s().-]{7,}\d'), '[phone]');
  }

  String _messageForException(AuthException error) {
    if (error is AuthNotAuthorizedException || error is UserNotFoundException) {
      return 'Email hoặc mã xác nhận không đúng.';
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
