import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  static const Color _brand = Color(0xFFFF5E00);
  static const Color _muted = Color(0xFF8E8E9A);

  static const List<_MapRestaurant> _restaurants = [
    _MapRestaurant(
      name: 'Phở Thìn Bờ Hồ',
      rating: '4.9',
      distance: '0.4 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/cbbe0b4d6e4f98216d58583a392e35400bd02888?width=480',
    ),
    _MapRestaurant(
      name: 'Quán Nướng Sài Gòn',
      rating: '4.8',
      distance: '0.9 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/679e1d9bab013589f5dde0d20724c395e2b0ddb7?width=480',
    ),
    _MapRestaurant(
      name: 'Sakura Sushi Bar',
      rating: '4.7',
      distance: '1.2 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/46d0a38a098d474174d9d50d228ec2814c5b19ef?width=480',
    ),
    _MapRestaurant(
      name: 'Bún Bò Huế Nguyên Chất',
      rating: '4.8',
      distance: '1.6 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/9cc215312fb496856dc9cdb017db5c5222b9478b?width=480',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('map-page'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 110),
      children: [
        _sectionHeader(),
        const SizedBox(height: 16),
        _mapSearchBox(),
        const SizedBox(height: 16),
        _mapPreview(),
        const SizedBox(height: 18),
        const Text(
          'Quán gần vị trí của bạn',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: Colors.black,
          ),
        ),
        const SizedBox(height: 12),
        for (final restaurant in _restaurants) ...[
          _mapRestaurantTile(restaurant),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _sectionHeader() {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: _brand.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(15),
          ),
          child: const Icon(Icons.map_rounded, color: _brand, size: 25),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bản đồ',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.black,
                ),
              ),
              SizedBox(height: 2),
              Text(
                'Tìm quán ăn, nước uống gần bạn',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _muted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _mapSearchBox() {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F1F1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            offset: const Offset(3, 4),
            blurRadius: 12,
          ),
        ],
      ),
      child: const Row(
        children: [
          Icon(Icons.search_rounded, size: 20, color: _brand),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Tìm quán ăn, cà phê, trà sữa...',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF9CA3AF),
              ),
            ),
          ),
          Icon(Icons.tune_rounded, size: 19, color: _muted),
        ],
      ),
    );
  }

  Widget _mapPreview() {
    return Container(
      height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFF3EA), Color(0xFFF3F4F6)],
        ),
        border: Border.all(color: const Color(0xFFFFE0CC)),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              child: CustomPaint(painter: _MapGridPainter()),
            ),
          ),
          _mapPin(top: 34, left: 46, label: 'Phở', color: _brand),
          _mapPin(
            top: 76,
            right: 38,
            label: 'Cafe',
            color: const Color(0xFF8B5CF6),
          ),
          _mapPin(
            bottom: 42,
            left: 72,
            label: 'Sushi',
            color: const Color(0xFF06B6D4),
          ),
          _mapPin(
            bottom: 72,
            right: 62,
            label: 'Pizza',
            color: const Color(0xFFF59E0B),
          ),
          Center(
            child: Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: _brand.withValues(alpha: 0.18),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 4),
              ),
              child: const Icon(Icons.my_location_rounded, color: _brand),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mapPin({
    double? top,
    double? left,
    double? right,
    double? bottom,
    required String label,
    required Color color,
  }) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.22),
              offset: const Offset(2, 3),
              blurRadius: 9,
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_on_rounded, color: color, size: 16),
            const SizedBox(width: 3),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mapRestaurantTile(_MapRestaurant restaurant) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF4F4F4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            offset: const Offset(2, 3),
            blurRadius: 10,
          ),
        ],
      ),
      child: Row(
        children: [
          OptimizedNetworkImage(
            imageUrl: restaurant.image,
            width: 62,
            height: 62,
            semanticLabel: restaurant.name,
            borderRadius: 16,
            fallbackIconSize: 24,
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Colors.black,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 15, color: _brand),
                    const SizedBox(width: 2),
                    Text(
                      restaurant.rating,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.place_rounded, size: 14, color: _muted),
                    const SizedBox(width: 2),
                    Text(
                      restaurant.distance,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _muted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  restaurant.status,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF22C55E),
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: _brand.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: () {},
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: 36,
                height: 36,
                child: Semantics(
                  button: true,
                  label: 'Chỉ đường đến quán',
                  child: const Icon(
                    Icons.near_me_rounded,
                    color: _brand,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapRestaurant {
  const _MapRestaurant({
    required this.name,
    required this.rating,
    required this.distance,
    required this.status,
    required this.image,
  });

  final String name;
  final String rating;
  final String distance;
  final String status;
  final String image;
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;
    final thinRoadPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.62)
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(size.width * 0.08, size.height * 0.28),
      Offset(size.width * 0.92, size.height * 0.18),
      roadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.18, size.height * 0.86),
      Offset(size.width * 0.86, size.height * 0.36),
      roadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.24, size.height * 0.08),
      Offset(size.width * 0.34, size.height * 0.92),
      thinRoadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.68, size.height * 0.08),
      Offset(size.width * 0.78, size.height * 0.9),
      thinRoadPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
