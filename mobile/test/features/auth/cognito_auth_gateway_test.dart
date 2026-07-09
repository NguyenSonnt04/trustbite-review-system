import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';

void main() {
  const unconfigured = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  const configured = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: 'ap-southeast-1_testpool',
    cognitoClientId: 'testclient123',
  );

  test('rejects blank credentials before calling Cognito', () async {
    final gateway = AmplifyCognitoAuthGateway(config: unconfigured);

    await expectLater(
      gateway.signIn(identifier: ' ', password: 'Password1!'),
      throwsA(
        isA<CognitoAuthGatewayException>().having(
          (error) => error.message,
          'message',
          'Vui lòng nhập email hoặc số điện thoại.',
        ),
      ),
    );
    await expectLater(
      gateway.signIn(identifier: 'user@example.com', password: ''),
      throwsA(
        isA<CognitoAuthGatewayException>().having(
          (error) => error.message,
          'message',
          'Vui lòng nhập mật khẩu.',
        ),
      ),
    );
  });

  test('fails closed when Cognito runtime configuration is missing', () async {
    final gateway = AmplifyCognitoAuthGateway(config: unconfigured);

    await expectLater(
      gateway.signIn(identifier: 'user@example.com', password: 'Password1!'),
      throwsA(
        isA<CognitoAuthGatewayException>().having(
          (error) => error.message,
          'message',
          'Cognito chưa được cấu hình cho ứng dụng.',
        ),
      ),
    );
  });

  test(
    'builds Amplify Cognito plugin configuration with the expected schema',
    () {
      final gateway = AmplifyCognitoAuthGateway(config: configured);

      final decoded =
          jsonDecode(gateway.buildAmplifyConfigurationJson())
              as Map<String, dynamic>;
      final auth = decoded['auth'] as Map<String, dynamic>;
      final plugins = auth['plugins'] as Map<String, dynamic>;
      final cognitoPlugin =
          plugins['awsCognitoAuthPlugin'] as Map<String, dynamic>;
      final userPools =
          cognitoPlugin['CognitoUserPool'] as Map<String, dynamic>;
      final userPool = userPools['Default'] as Map<String, dynamic>;

      expect(decoded['Version'], '1.0');
      expect(userPool, {
        'PoolId': 'ap-southeast-1_testpool',
        'AppClientId': 'testclient123',
        'Region': 'ap-southeast-1',
      });
      expect(auth['aws_region'], isNull);
      expect(auth['user_pool_id'], isNull);
      expect(auth['user_pool_client_id'], isNull);
    },
  );
}
