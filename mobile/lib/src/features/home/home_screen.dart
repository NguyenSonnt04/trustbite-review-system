import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/login_screen.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/auth/profile_onboarding_screen.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/pages/discover_page.dart';
import 'package:trustbite_mobile/src/features/home/pages/favorites_page.dart';
import 'package:trustbite_mobile/src/features/home/pages/profile_page.dart';
import 'package:trustbite_mobile/src/features/home/widgets/trustbite_bottom_nav.dart';
import 'package:trustbite_mobile/src/features/map/map_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    this.authService,
    this.cognitoAuthGateway,
    this.restaurantRepository,
  });

  final MobileAuthService? authService;
  final CognitoAuthGateway? cognitoAuthGateway;
  final RestaurantDiscoveryRepository? restaurantRepository;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _activeNav = 0;
  int _activeServiceIndex = 0;
  bool _isSignedIn = false;
  Map<String, dynamic>? _currentUser;
  late final RestaurantDiscoveryRepository _restaurantRepository;

  @override
  void initState() {
    super.initState();
    _restaurantRepository =
        widget.restaurantRepository ??
        RestaurantDiscoveryService(apiClient: appApiClient);
    _loadAuthState();
  }

  Future<void> _loadAuthState() async {
    final session = await appAuthSessionStore.read();
    final cognitoSignedIn =
        await (widget.cognitoAuthGateway ?? appCognitoAuthGateway).isSignedIn();
    if (!mounted) return;
    if (session == null && !cognitoSignedIn) {
      setState(() => _isSignedIn = false);
      return;
    }

    final authService = widget.authService ?? appMobileAuthService;
    try {
      var user = cognitoSignedIn
          ? await authService.completeCognitoSignIn()
          : await authService.loadCurrentUser();
      if (!mounted) return;
      if (user['profileComplete'] != true) {
        final completedUser = await Navigator.of(context)
            .push<Map<String, dynamic>>(
              MaterialPageRoute<Map<String, dynamic>>(
                builder: (_) => ProfileOnboardingScreen(
                  authService: authService,
                  initialUser: user,
                ),
              ),
            );
        if (!mounted) return;
        if (completedUser == null) {
          setState(() {
            _isSignedIn = false;
            _currentUser = null;
          });
          return;
        }
        user = completedUser;
      }
      setState(() {
        _isSignedIn = true;
        _currentUser = user;
      });
    } catch (error) {
      debugPrint(
        'Unable to restore signed-in user profile: ${error.runtimeType}',
      );
      if (!mounted) return;
      setState(() {
        _isSignedIn = false;
        _currentUser = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể khôi phục phiên đăng nhập. Vui lòng kiểm tra kết nối và thử lại.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<bool> _openLogin() async {
    final user = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute<Map<String, dynamic>>(
        builder: (_) => LoginScreen(
          authService: widget.authService,
          cognitoAuthGateway: widget.cognitoAuthGateway,
        ),
      ),
    );

    if (!mounted) return false;
    if (user != null) {
      setState(() {
        _isSignedIn = true;
        _currentUser = user;
      });
      final displayName =
          user['displayName'] ?? user['phoneNumber'] ?? 'tài khoản';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã đăng nhập với $displayName.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return true;
    }

    await _loadAuthState();
    return _isSignedIn;
  }

  Future<void> _logout() async {
    await (widget.authService ?? appMobileAuthService).signOut();
    if (!mounted) return;
    setState(() {
      _isSignedIn = false;
      _currentUser = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Đã đăng xuất.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: Colors.white,
                image: DecorationImage(
                  image: AssetImage('assets/bg/bg_main.png'),
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                ),
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 260),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, animation) {
                        final slideAnimation = Tween<Offset>(
                          begin: const Offset(0.04, 0),
                          end: Offset.zero,
                        ).animate(animation);

                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: slideAnimation,
                            child: child,
                          ),
                        );
                      },
                      child: _buildActivePage(),
                    ),
                  ),
                  const Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 176,
                    child: _BottomContentFade(),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 0,
                    child: SafeArea(
                      top: false,
                      minimum: const EdgeInsets.only(bottom: 14),
                      child: TrustBiteBottomNav(
                        activeIndex: _activeNav,
                        onSelected: (index) => setState(() {
                          _activeNav = index;
                        }),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActivePage() {
    return switch (_activeNav) {
      0 => DiscoverPage(
        activeServiceIndex: _activeServiceIndex,
        onServiceSelected: (index) => setState(() {
          _activeServiceIndex = index;
        }),
        isSignedIn: _isSignedIn,
        currentUser: _currentUser,
        onLogin: _openLogin,
        restaurantRepository: _restaurantRepository,
      ),
      1 => const MapScreen(),
      2 => const FavoritesPage(),
      _ => ProfilePage(
        isSignedIn: _isSignedIn,
        currentUser: _currentUser,
        onLogin: _openLogin,
        onLogout: _logout,
      ),
    };
  }
}

class _BottomContentFade extends StatelessWidget {
  const _BottomContentFade();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.white.withValues(alpha: 0),
              Colors.white.withValues(alpha: 0.74),
              Colors.white.withValues(alpha: 0.97),
              Colors.white,
            ],
            stops: const [0, 0.42, 0.74, 1],
          ),
        ),
      ),
    );
  }
}
