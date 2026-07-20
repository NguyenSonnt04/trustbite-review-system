import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/pages/favorites_page.dart';

class SaveRestaurantServicePage extends StatefulWidget {
  const SaveRestaurantServicePage({
    super.key,
    required this.onLogin,
    required this.onAuthenticationRequired,
    required this.favoritesRepository,
    required this.restaurantRepository,
  });

  final Future<bool> Function() onLogin;
  final Future<void> Function() onAuthenticationRequired;
  final FavoritesRepository favoritesRepository;
  final RestaurantDiscoveryRepository restaurantRepository;

  @override
  State<SaveRestaurantServicePage> createState() =>
      _SaveRestaurantServicePageState();
}

class _SaveRestaurantServicePageState extends State<SaveRestaurantServicePage> {
  bool _isSignedIn = true;

  Future<bool> _login() async {
    final signedIn = await widget.onLogin();
    if (mounted && signedIn) setState(() => _isSignedIn = true);
    return signedIn;
  }

  Future<void> _authenticationRequired() async {
    await widget.onAuthenticationRequired();
    if (mounted) setState(() => _isSignedIn = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('save-restaurant-service-page'),
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
                height: 72,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      Material(
                        color: const Color(0xFFFFE9D6),
                        borderRadius: BorderRadius.circular(16),
                        child: IconButton(
                          tooltip: 'Quay lại',
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.arrow_back_rounded),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bộ sưu tập đã lưu',
                              style: TextStyle(
                                color: Color(0xFF17130F),
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Quán hay, giữ lại một chạm',
                              style: TextStyle(
                                color: Color(0xFF716B65),
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF5E00),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: const Icon(
                          Icons.bookmark_rounded,
                          color: Color(0xFFFFF8F2),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: FavoritesPage(
                  isSignedIn: _isSignedIn,
                  onLogin: _login,
                  onAuthenticationRequired: _authenticationRequired,
                  favoritesRepository: widget.favoritesRepository,
                  restaurantRepository: widget.restaurantRepository,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
