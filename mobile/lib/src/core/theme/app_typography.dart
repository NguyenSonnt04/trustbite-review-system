import 'package:flutter/material.dart';

class AppTypography {
  const AppTypography._();

  static const String fontFamily = 'SF Pro Display';
  static const List<String> fontFamilyFallback = [
    'SF Pro Text',
    'SF Pro',
    'Inter',
    'Roboto',
    'Arial',
  ];

  static const Color ink = Color(0xFF111827);
  static const Color muted = Color(0xFF8E8E9A);
  static const Color inverse = Color(0xFFF9FAFB);

  static const TextStyle brandMark = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 20,
    height: 1,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle screenTitle = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 28,
    height: 1.08,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle sectionTitle = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 20,
    height: 1.1,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle cardTitle = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 18,
    height: 1.16,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle title = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 16,
    height: 1.18,
    fontWeight: FontWeight.w800,
    letterSpacing: 0,
  );

  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    height: 1.35,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    height: 1.25,
    fontWeight: FontWeight.w800,
    letterSpacing: 0,
  );

  static const TextStyle label = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 13,
    height: 1.16,
    fontWeight: FontWeight.w700,
    letterSpacing: 0,
  );

  static const TextStyle labelStrong = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 13,
    height: 1.16,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 12,
    height: 1.22,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
  );

  static const TextStyle tiny = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 11,
    height: 1.14,
    fontWeight: FontWeight.w700,
    letterSpacing: 0,
  );

  static const TextStyle button = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 15,
    height: 1,
    fontWeight: FontWeight.w900,
    letterSpacing: 0,
  );

  static const TextStyle bottomNav = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 11,
    height: 1.1,
    fontWeight: FontWeight.w800,
    letterSpacing: 0,
  );

  static TextTheme textTheme(Brightness brightness) {
    final primary = brightness == Brightness.dark ? inverse : ink;
    final secondary =
        brightness == Brightness.dark ? const Color(0xFFC6CBD4) : muted;

    return TextTheme(
      displayLarge: screenTitle.copyWith(color: primary),
      headlineLarge: sectionTitle.copyWith(color: primary),
      headlineMedium: cardTitle.copyWith(color: primary),
      titleLarge: title.copyWith(color: primary),
      titleMedium: bodyStrong.copyWith(color: primary),
      bodyLarge: body.copyWith(color: primary),
      bodyMedium: body.copyWith(color: secondary),
      labelLarge: button.copyWith(color: primary),
      labelMedium: label.copyWith(color: primary),
      labelSmall: caption.copyWith(color: secondary),
    );
  }
}
