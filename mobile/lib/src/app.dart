import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_theme.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';

class TrustBiteApp extends StatelessWidget {
  const TrustBiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrustBite',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      home: const LoginScreen(),
    );
  }
}
