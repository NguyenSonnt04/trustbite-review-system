import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('TrustBite'),
        centerTitle: false,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Trust in every bite',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Mobile app shell for verified food reviews, receipt checks, and restaurant trust scores.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 24),
            const _FeatureTile(
              icon: Icons.verified_user_outlined,
              title: 'Verified reviews',
              subtitle: 'Prepare OCR and GPS validation flows for receipts.',
            ),
            const _FeatureTile(
              icon: Icons.restaurant_menu_outlined,
              title: 'Restaurant trust scores',
              subtitle: 'Show menu status, review quality, and price alerts.',
            ),
            const _FeatureTile(
              icon: Icons.map_outlined,
              title: 'Nearby discovery',
              subtitle: 'Connect the app to location-based restaurant search.',
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
      ),
    );
  }
}
