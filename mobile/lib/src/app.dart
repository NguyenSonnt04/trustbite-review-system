import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_scroll_behavior.dart';
import 'package:trustbite_mobile/src/core/theme/app_theme.dart';
import 'package:trustbite_mobile/src/features/home/home_screen.dart';
import 'package:trustbite_mobile/src/features/launch/brand_launch_screen.dart';

class TrustBiteApp extends StatelessWidget {
  const TrustBiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrustBite',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      scrollBehavior: const AppScrollBehavior(),
      home: const BrandLaunchScreen(child: HomeScreen()),
    );
  }
}
