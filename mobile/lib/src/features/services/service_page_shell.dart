import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

enum ServiceDataSource { live, mixed, mock }

class ServicePageShell extends StatelessWidget {
  const ServicePageShell({
    super.key,
    required this.pageKey,
    required this.title,
    required this.subtitle,
    required this.dataSource,
    required this.child,
    this.header,
  });

  final Key pageKey;
  final String title;
  final String subtitle;
  final ServiceDataSource dataSource;
  final Widget child;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: pageKey,
      backgroundColor: const Color(0xFFF7F7F8),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F7F8),
          image: DecorationImage(
            image: AssetImage('assets/bg/bg_main.png'),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            opacity: 0.42,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              SizedBox(
                height: 68,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Quay lại',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 18,
                            height: 1.16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 36),
                      children: [
                        header ??
                            _DefaultServiceHeader(
                              title: title,
                              subtitle: subtitle,
                            ),
                        const SizedBox(height: 24),
                        child,
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DefaultServiceHeader extends StatelessWidget {
  const _DefaultServiceHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 28,
            height: 1.08,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: AppTypography.body.copyWith(
            color: const Color(0xFF4F4F59),
            height: 1.35,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class ServiceSurface extends StatelessWidget {
  const ServiceSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1EDE8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.045),
            offset: const Offset(0, 10),
            blurRadius: 24,
          ),
        ],
      ),
      child: child,
    );
  }
}

class ServiceSectionTitle extends StatelessWidget {
  const ServiceSectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Color(0xFF111827),
        fontSize: 20,
        height: 1.1,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class ServiceRestaurantPicker extends StatelessWidget {
  const ServiceRestaurantPicker({
    super.key,
    required this.restaurants,
    required this.onSelected,
    this.selected,
    this.label = 'Chọn nhà hàng',
    this.accentColor = const Color(0xFFFF5E00),
    this.excludeRestaurantId,
  });

  final List<HomeRestaurant> restaurants;
  final ValueChanged<HomeRestaurant> onSelected;
  final HomeRestaurant? selected;
  final String label;
  final Color accentColor;
  final String? excludeRestaurantId;

  @override
  Widget build(BuildContext context) {
    final restaurant = selected;
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: const Color(0xFFFFFEFC),
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () async {
            final result = await showServiceRestaurantPicker(
              context,
              restaurants: restaurants,
              title: label,
              accentColor: accentColor,
              excludeRestaurantId: excludeRestaurantId,
            );
            if (result != null) onSelected(result);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: restaurant == null
                    ? const Color(0xFFE7E4E0)
                    : accentColor.withValues(alpha: 0.42),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1D1712).withValues(alpha: 0.05),
                  offset: const Offset(0, 8),
                  blurRadius: 24,
                ),
              ],
            ),
            child: Row(
              children: [
                if (restaurant == null)
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(Icons.storefront_rounded, color: accentColor),
                  )
                else
                  OptimizedNetworkImage(
                    imageUrl: restaurant.image,
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    semanticLabel: restaurant.name,
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        restaurant?.name ?? label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.bodyStrong.copyWith(
                          color: const Color(0xFF17130F),
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        restaurant == null
                            ? 'Chạm để xem danh sách trực quan'
                            : [
                                restaurant.rating,
                                if (restaurant.distance != null)
                                  restaurant.distance!,
                              ].join('  •  '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(
                          color: const Color(0xFF716B65),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF4F1ED),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Color(0xFF4C4741),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<HomeRestaurant?> showServiceRestaurantPicker(
  BuildContext context, {
  required List<HomeRestaurant> restaurants,
  required String title,
  required Color accentColor,
  String? excludeRestaurantId,
}) {
  return showModalBottomSheet<HomeRestaurant>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: const Color(0xFFFBFAF8),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
    ),
    builder: (_) => _RestaurantPickerSheet(
      restaurants: restaurants,
      title: title,
      accentColor: accentColor,
      excludeRestaurantId: excludeRestaurantId,
    ),
  );
}

class _RestaurantPickerSheet extends StatefulWidget {
  const _RestaurantPickerSheet({
    required this.restaurants,
    required this.title,
    required this.accentColor,
    this.excludeRestaurantId,
  });

  final List<HomeRestaurant> restaurants;
  final String title;
  final Color accentColor;
  final String? excludeRestaurantId;

  @override
  State<_RestaurantPickerSheet> createState() => _RestaurantPickerSheetState();
}

class _RestaurantPickerSheetState extends State<_RestaurantPickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final normalizedQuery = _normalizeVietnameseSearch(_query);
    final results = widget.restaurants
        .where((restaurant) => restaurant.id != widget.excludeRestaurantId)
        .where(
          (restaurant) => _normalizeVietnameseSearch(
            restaurant.name,
          ).contains(normalizedQuery),
        )
        .toList(growable: false);
    return FractionallySizedBox(
      heightFactor: 0.82,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 42,
            height: 5,
            decoration: BoxDecoration(
              color: const Color(0xFFD9D4CE),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.title,
                        style: const TextStyle(
                          color: Color(0xFF17130F),
                          fontSize: 23,
                          height: 1.1,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${results.length} lựa chọn phù hợp',
                        style: AppTypography.caption.copyWith(
                          color: const Color(0xFF716B65),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: TextField(
              key: const ValueKey('restaurant-picker-search'),
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value.trim()),
              decoration: InputDecoration(
                hintText: 'Tìm theo tên quán',
                prefixIcon: const Icon(Icons.search_rounded),
                filled: true,
                fillColor: const Color(0xFFF2F0ED),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide(color: widget.accentColor, width: 1.5),
                ),
              ),
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? const Center(child: Text('Không tìm thấy nhà hàng phù hợp.'))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    itemCount: results.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final restaurant = results[index];
                      return Material(
                        color: const Color(0xFFFFFEFC),
                        borderRadius: BorderRadius.circular(20),
                        child: InkWell(
                          key: ValueKey(
                            'restaurant-picker-option-${restaurant.id}',
                          ),
                          borderRadius: BorderRadius.circular(20),
                          onTap: () => Navigator.of(context).pop(restaurant),
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Row(
                              children: [
                                OptimizedNetworkImage(
                                  imageUrl: restaurant.image,
                                  width: 58,
                                  height: 58,
                                  borderRadius: 17,
                                  semanticLabel: restaurant.name,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        restaurant.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.bodyStrong
                                            .copyWith(
                                              color: const Color(0xFF17130F),
                                              fontWeight: FontWeight.w900,
                                            ),
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        [
                                          '★ ${restaurant.rating}',
                                          if (restaurant.distance != null)
                                            restaurant.distance!,
                                          restaurant.status,
                                        ].join('  •  '),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.tiny.copyWith(
                                          color: const Color(0xFF716B65),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(
                                  Icons.arrow_forward_ios_rounded,
                                  size: 15,
                                  color: widget.accentColor,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

String _normalizeVietnameseSearch(String value) {
  var normalized = value.toLowerCase();
  const replacements = <String, String>{
    'àáạảãâầấậẩẫăằắặẳẵ': 'a',
    'èéẹẻẽêềếệểễ': 'e',
    'ìíịỉĩ': 'i',
    'òóọỏõôồốộổỗơờớợởỡ': 'o',
    'ùúụủũưừứựửữ': 'u',
    'ỳýỵỷỹ': 'y',
    'đ': 'd',
  };
  for (final entry in replacements.entries) {
    for (final character in entry.key.split('')) {
      normalized = normalized.replaceAll(character, entry.value);
    }
  }
  return normalized;
}

class ServiceRestaurantTile extends StatelessWidget {
  const ServiceRestaurantTile({
    super.key,
    required this.restaurant,
    this.trailing,
    this.onTap,
    this.subtitle,
  });

  final HomeRestaurant restaurant;
  final Widget? trailing;
  final VoidCallback? onTap;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              OptimizedNetworkImage(
                imageUrl: restaurant.image,
                width: 58,
                height: 58,
                borderRadius: 16,
                semanticLabel: restaurant.name,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      restaurant.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFF111827),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle ??
                          [
                            restaurant.rating,
                            if (restaurant.distance != null)
                              restaurant.distance!,
                            restaurant.status,
                          ].join(' • '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF55555F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 10), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}

class ServiceMessage extends StatelessWidget {
  const ServiceMessage({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return ServiceSurface(
      child: Column(
        children: [
          const Icon(
            Icons.info_outline_rounded,
            color: Color(0xFF666A72),
            size: 30,
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppTypography.bodyStrong.copyWith(
              color: const Color(0xFF4F4F59),
              fontWeight: FontWeight.w800,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            TextButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ],
      ),
    );
  }
}

class ServiceLoading extends StatelessWidget {
  const ServiceLoading({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 220,
      child: Center(child: CircularProgressIndicator(color: HomeColors.brand)),
    );
  }
}
