import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/app.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await appCognitoAuthGateway.initialize();
  } catch (_) {
    // The app still starts so the login screen can show a safe configuration
    // error. Authentication remains fail-closed.
    debugPrint('Cognito initialization unavailable; auth remains disabled.');
  }
  runApp(const TrustBiteApp());
}
