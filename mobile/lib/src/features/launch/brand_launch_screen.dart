import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class BrandLaunchScreen extends StatefulWidget {
  const BrandLaunchScreen({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 850),
  });

  final Widget child;
  final Duration duration;

  @override
  State<BrandLaunchScreen> createState() => _BrandLaunchScreenState();
}

class _BrandLaunchScreenState extends State<BrandLaunchScreen> {
  bool _showLaunch = true;
  Timer? _handoffTimer;

  @override
  void initState() {
    super.initState();
    _handoffTimer = Timer(widget.duration, () {
      if (mounted) {
        setState(() => _showLaunch = false);
      }
    });
  }

  @override
  void dispose() {
    _handoffTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 240),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      child: _showLaunch
          ? const _LaunchView(key: ValueKey('brand-launch-view'))
          : widget.child,
    );
  }
}

class _LaunchView extends StatelessWidget {
  const _LaunchView({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final markSize = math.min(size.width * 0.43, 174.0);

    return Scaffold(
      backgroundColor: const Color(0xFFFFF7EF),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          image: DecorationImage(
            image: AssetImage('assets/bg/bg_main.png'),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFFFFF7EF).withValues(alpha: 0.68),
                const Color(0xFFFFFBF7).withValues(alpha: 0.94),
                const Color(0xFFFFF7EF),
              ],
              stops: const [0, 0.58, 1],
            ),
          ),
          child: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(28, 34, 28, 30),
                  child: Column(
                    children: [
                      const Spacer(flex: 3),
                      _LaunchMark(size: markSize),
                      const SizedBox(height: 24),
                      Semantics(
                        header: true,
                        child: RichText(
                          key: const ValueKey('brand-launch-title'),
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: AppTypography.screenTitle.copyWith(
                              color: AppTypography.ink,
                              fontSize: 32,
                            ),
                            children: const [
                              TextSpan(text: 'Trust'),
                              TextSpan(
                                text: 'Bite',
                                style: TextStyle(color: HomeColors.brand),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        'Review thật, ăn yên tâm.',
                        textAlign: TextAlign.center,
                        style: AppTypography.bodyStrong.copyWith(
                          color: const Color(0xFF4B5563),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const _TrustSignals(),
                      const Spacer(flex: 4),
                      Text(
                        'Đang chuẩn bị gợi ý gần bạn',
                        textAlign: TextAlign.center,
                        style: AppTypography.caption.copyWith(
                          color: HomeColors.muted,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LaunchMark extends StatelessWidget {
  const _LaunchMark({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.035),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFF120906),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.95),
          width: 5,
        ),
        boxShadow: [
          BoxShadow(
            color: HomeColors.brand.withValues(alpha: 0.28),
            offset: const Offset(0, 18),
            blurRadius: 38,
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            offset: const Offset(0, 10),
            blurRadius: 24,
          ),
        ],
      ),
      child: ClipOval(
        child: Image.asset(
          'assets/app_icon.png',
          fit: BoxFit.cover,
          filterQuality: FilterQuality.high,
        ),
      ),
    );
  }
}

class _TrustSignals extends StatelessWidget {
  const _TrustSignals();

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        _TrustSignal(icon: Icons.receipt_long_rounded, label: 'Bill'),
        _TrustSignal(icon: Icons.place_rounded, label: 'GPS'),
        _TrustSignal(icon: Icons.verified_rounded, label: 'Trust'),
      ],
    );
  }
}

class _TrustSignal extends StatelessWidget {
  const _TrustSignal({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFFFE2D2)),
        boxShadow: [
          BoxShadow(
            color: HomeColors.brand.withValues(alpha: 0.08),
            offset: const Offset(0, 8),
            blurRadius: 18,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: HomeColors.brand),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTypography.tiny.copyWith(
              color: const Color(0xFF111827),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
