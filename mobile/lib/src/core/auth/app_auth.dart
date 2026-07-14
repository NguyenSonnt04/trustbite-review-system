import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';

final appAuthSessionStore = InMemoryAuthSessionStore();

final appMobileRuntimeConfig = MobileRuntimeConfig.fromEnvironment();

final appCognitoAuthGateway = AmplifyCognitoAuthGateway(
  config: appMobileRuntimeConfig,
);

final appApiClient = TrustBiteApiClient(
  config: appMobileRuntimeConfig,
  sessionStore: appAuthSessionStore,
  cognitoSessionProvider: appCognitoAuthGateway,
);

final appMobileAuthService = MobileAuthService(
  apiClient: appApiClient,
  sessionStore: appAuthSessionStore,
  cognitoSessionProvider: appCognitoAuthGateway,
);

final appReviewService = ReviewService(apiClient: appApiClient);
