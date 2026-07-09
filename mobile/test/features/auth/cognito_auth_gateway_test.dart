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
}
