import 'package:flutter/material.dart';

/// Discover screen converted from the Builder.io / Figma "Tìm với TrustBite"
/// mobile layout. Mirrors the web `client/src/app/discover` reference design:
/// status bar, header, search, "Gần bạn" horizontal cards, "Dịch vụ" grid and
/// a floating bottom navigation bar.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const Color _brand = Color(0xFFFF5E00);
  static const Color _muted = Color(0xFF8E8E9A);

  int _activeNav = 0;
  int _activeCategory = 0;

  static const List<_Restaurant> _restaurants = [
    _Restaurant(
      name: 'Phở Thìn Bờ Hồ',
      rating: '4.9',
      distance: '0.4 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/cbbe0b4d6e4f98216d58583a392e35400bd02888?width=480',
      featured: false,
    ),
    _Restaurant(
      name: 'Quán Nướng Sài Gòn',
      rating: '4.8',
      distance: '0.9 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/679e1d9bab013589f5dde0d20724c395e2b0ddb7?width=480',
      featured: false,
    ),
    _Restaurant(
      name: 'Sakura Sushi Bar',
      rating: '4.7',
      distance: '1.2 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/46d0a38a098d474174d9d50d228ec2814c5b19ef?width=480',
      featured: true,
    ),
    _Restaurant(
      name: 'Bún Bò Huế Nguyên Chất',
      rating: '4.8',
      distance: '1.6 km',
      status: 'Đang mở',
      image:
          'https://api.builder.io/api/v1/image/assets/TEMP/9cc215312fb496856dc9cdb017db5c5222b9478b?width=480',
      featured: true,
    ),
  ];

  static const List<_Category> _categories = [
    _Category(icon: Icons.restaurant_menu_rounded, label: 'Thức ăn', color: Color(0xFFFF5E00)),
    _Category(icon: Icons.local_cafe_rounded, label: 'Nước uống', color: Color(0xFF8B5CF6)),
    _Category(icon: Icons.ramen_dining_rounded, label: 'Lẩu', color: Color(0xFFEF4444)),
    _Category(icon: Icons.set_meal_rounded, label: 'Sushi', color: Color(0xFF06B6D4)),
    _Category(icon: Icons.local_pizza_rounded, label: 'Pizza', color: Color(0xFFF59E0B)),
    _Category(icon: Icons.lunch_dining_rounded, label: 'Hamburger', color: Color(0xFFEAB308)),
    _Category(icon: Icons.eco_rounded, label: 'Chay', color: Color(0xFF22C55E)),
    _Category(icon: Icons.cake_rounded, label: 'Bánh ngọt', color: Color(0xFFEC4899)),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              color: Colors.white,
              child: Stack(
                children: [
                  ListView(
                    padding: const EdgeInsets.only(bottom: 110),
                    children: [
                      _buildHeader(),
                      _buildTitleAndSearch(),
                      const SizedBox(height: 30),
                      _buildNearbySection(),
                      const SizedBox(height: 20),
                      _buildServicesSection(),
                    ],
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 20,
                    child: _buildBottomNav(),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() { 
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _brand,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'T',
                  style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.w900,
                    fontSize: 20,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Vị trí hiện tại',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.black.withValues(alpha: 0.3),
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Row(
                    children: [
                      Text(
                        'Quận 1, TP.HCM',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(Icons.keyboard_arrow_down, size: 14, color: _brand),
                    ],
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.notifications_outlined,
                      size: 25,
                      color: _brand,
                    ),
                  ),
                  Positioned(
                    top: -4,
                    right: 0,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        '3',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  'https://api.builder.io/api/v1/image/assets/TEMP/004503e6884bf7e9e9f380e2da7a60ba140c23a1?width=80',
                  width: 40,
                  height: 40,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 40,
                    height: 40,
                    color: const Color(0xFFE5E7EB),
                    child: const Icon(Icons.person, size: 20),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTitleAndSearch() {
    return Padding(
      padding: const EdgeInsets.only(
        left: 20,
        right: 20,
        top: 30,
        bottom: 10,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                height: 1.1,
              ),
              children: [
                TextSpan(text: 'Tìm với ', style: TextStyle(color: Colors.black)),
                TextSpan(text: 'TrustBite', style: TextStyle(color: _brand)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF4F4F4)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.09),
                  offset: const Offset(4, 4),
                  blurRadius: 10,
                ),
              ],
            ),
            child: const Row(
              children: [
                Icon(Icons.search, size: 16, color: _brand),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Tìm quán, món ăn, nước uống ...',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNearbySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Gần bạn',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.black,
                    ),
                  ),
                  Text(
                    'Quán nổi bật trong khu vực',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _muted,
                    ),
                  ),
                ],
              ),
              _seeAllChip(),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 160,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: _restaurants.length,
            separatorBuilder: (_, __) => const SizedBox(width: 16),
            itemBuilder: (context, index) => _restaurantCard(_restaurants[index]),
          ),
        ),
      ],
    );
  }

  Widget _restaurantCard(_Restaurant r) {
    return SizedBox(
      width: 240,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              r.image,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: const Color(0xFFE5E7EB),
                child: const Icon(Icons.restaurant, size: 32),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.78),
                    _brand.withValues(alpha: 0.18),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            if (r.featured)
              Positioned(
                top: 10,
                left: 12,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _brand.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: _brand.withValues(alpha: 0.25),
                        offset: const Offset(0, 3),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.local_fire_department_rounded,
                          size: 12, color: Colors.white),
                      SizedBox(width: 3),
                      Text(
                        'Nổi bật',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Positioned(
              top: 10,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: _brand),
                    const SizedBox(width: 3),
                    Text(
                      r.rating,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF22C55E).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFB6FF9C).withValues(alpha: 0.35),
                          ),
                        ),
                        child: Text(
                          r.status,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFB6FF9C),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.place_rounded,
                                size: 12, color: _brand),
                            const SizedBox(width: 3),
                            Text(
                              r.distance,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServicesSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dịch vụ',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.black,
                    ),
                  ),
                  Text(
                    'Danh mục món ăn phổ biến',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _muted,
                    ),
                  ),
                ],
              ),
              _seeAllChip(),
            ],
          ),
          const SizedBox(height: 26),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _categories.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisSpacing: 14,
              crossAxisSpacing: 12,
              childAspectRatio: 0.92,
            ),
            itemBuilder: (context, index) {
              final cat = _categories[index];
              final active = _activeCategory == index;
              return GestureDetector(
                onTap: () => setState(() => _activeCategory = index),
                child: Column(
                  children: [
                    Center(
                      child: Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          color: cat.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: active ? cat.color : cat.color.withValues(alpha: 0.18),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: cat.color.withValues(alpha: 0.16),
                              offset: const Offset(2, 3),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          cat.icon,
                          size: 26,
                          color: cat.color,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      cat.label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: active ? FontWeight.w900 : FontWeight.w600,
                        color: active ? _brand : Colors.black,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    const items = [
      (Icons.home_rounded, 'Trang chủ'),
      (Icons.map_outlined, 'Bản đồ'),
      (Icons.favorite_border, 'Yêu thích'),
      (Icons.person_outline, 'Tôi'),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: const Color.fromARGB(255, 95, 95, 95).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _activeNav = i),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _activeNav == i
                        ? const Color.fromARGB(255, 174, 174, 174).withValues(alpha: 0.2)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        items[i].$1,
                        size: 20,
                        color: _activeNav == i ? _brand : _muted,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        items[i].$2,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight:
                              _activeNav == i ? FontWeight.w900 : FontWeight.bold,
                          color: _activeNav == i ? _brand : _muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _seeAllChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: const Text(
        'Xem tất cả',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Color(0xFFFF7300),
        ),
      ),
    );
  }
}

class _Restaurant {
  const _Restaurant({
    required this.name,
    required this.rating,
    required this.distance,
    required this.status,
    required this.image,
    required this.featured,
  });

  final String name;
  final String rating;
  final String distance;
  final String status;
  final String image;
  final bool featured;
}

class _Category {
  const _Category({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;
}
