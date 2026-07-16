import 'package:flutter/material.dart';

class OptimizedNetworkImage extends StatelessWidget {
  const OptimizedNetworkImage({
    super.key,
    required this.imageUrl,
    required this.width,
    required this.height,
    this.borderRadius = 0,
    this.semanticLabel,
    this.fallbackIconSize = 28,
    this.fit = BoxFit.cover,
  });

  final String? imageUrl;
  final double width;
  final double height;
  final double borderRadius;
  final String? semanticLabel;
  final double fallbackIconSize;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final normalizedImageUrl = imageUrl?.trim();

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: width,
        height: height,
        child: normalizedImageUrl == null || normalizedImageUrl.isEmpty
            ? _ImageFallback(
                icon: Icons.image_not_supported_outlined,
                iconSize: fallbackIconSize,
              )
            : Image.network(
                normalizedImageUrl,
                width: width,
                height: height,
                fit: fit,
                semanticLabel: semanticLabel,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) {
                    return child;
                  }

                  return _ImageFallback(
                    icon: Icons.image_outlined,
                    iconSize: fallbackIconSize,
                  );
                },
                errorBuilder: (context, error, stackTrace) => _ImageFallback(
                  icon: Icons.broken_image_outlined,
                  iconSize: fallbackIconSize,
                ),
              ),
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({required this.icon, required this.iconSize});

  final IconData icon;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFE5E7EB),
      child: Center(
        child: Icon(icon, size: iconSize, color: const Color(0xFF8E8E9A)),
      ),
    );
  }
}
