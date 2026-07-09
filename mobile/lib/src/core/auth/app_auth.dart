import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';

final appAuthSessionStore = InMemoryAuthSessionStore();

final appApiClient = TrustBiteApiClient(
  config: MobileRuntimeConfig.fromEnvironment(),
  sessionStore: appAuthSessionStore,
);

final appMobileAuthService = MobileAuthService(
  apiClient: appApiClient,
  sessionStore: appAuthSessionStore,
);
