import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/features/map/map_screen.dart';

class NearbyServicePage extends StatelessWidget {
  const NearbyServicePage({
    super.key,
    required this.isSignedIn,
    required this.onLogin,
  });

  final bool isSignedIn;
  final Future<bool> Function() onLogin;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('nearby-service-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 72,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Material(
                      color: const Color(0xFFE8F1FF),
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
                            'Radar quanh bạn',
                            style: TextStyle(
                              color: Color(0xFF17233A),
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Di chuyển bản đồ để khám phá',
                            style: TextStyle(
                              color: Color(0xFF60708B),
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
                        color: const Color(0xFF2F67C8),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: const Icon(
                        Icons.near_me_rounded,
                        color: Color(0xFFF4F8FF),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: MapScreen(isSignedIn: isSignedIn, onLogin: onLogin),
            ),
          ],
        ),
      ),
    );
  }
}
