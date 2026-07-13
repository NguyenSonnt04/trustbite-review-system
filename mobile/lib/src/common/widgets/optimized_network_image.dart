import 'package:flutter/material.dart';

class OptimizedNetworkImage extends StatelessWidget {
  const OptimizedNetworkImage({
    super.key,
    required this.imageUrl,
    required this.width,
    required this.height,
    required this.semanticLabel,
    this.borderRadius = 0,
    this.fallbackIcon = Icons.restaurant_rounded,
    this.fallbackIconSize = 32,
    this.fallbackIconColor = const Color(0xFFFF5E00),
  });

  final String imageUrl;
  final double width;
  final double height;
  final String semanticLabel;
  final double borderRadius;
  final IconData fallbackIcon;
  final double fallbackIconSize;
  final Color fallbackIconColor;

  @override
  Widget build(BuildContext context) {
    final devicePixelRatio = MediaQuery.devicePixelRatioOf(context);
    final image = Image.network(
      imageUrl,
      fit: BoxFit.cover,
      semanticLabel: semanticLabel,
      cacheWidth: (width * devicePixelRatio).round(),
      cacheHeight: (height * devicePixelRatio).round(),
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return _ImageFallback(
          icon: fallbackIcon,
          iconSize: fallbackIconSize,
          iconColor: fallbackIconColor,
        );
      },
      errorBuilder: (_, __, ___) => _ImageFallback(
        icon: fallbackIcon,
        iconSize: fallbackIconSize,
        iconColor: fallbackIconColor,
      ),
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(width: width, height: height, child: image),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({
    required this.icon,
    required this.iconSize,
    required this.iconColor,
  });

  final IconData icon;
  final double iconSize;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFE5E7EB),
      child: Center(child: Icon(icon, size: iconSize, color: iconColor)),
    );
  }
}
