import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/features/home/widgets/empty_state_card.dart';
import 'package:trustbite_mobile/src/features/home/widgets/section_header.dart';

class FavoritesPage extends StatelessWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('favorites-page'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 110),
      children: const [
        SectionHeader(
          icon: Icons.favorite_rounded,
          title: 'Yêu thích',
          subtitle: 'Các địa điểm bạn đã lưu',
        ),
        SizedBox(height: 18),
        EmptyStateCard(
          icon: Icons.favorite_border_rounded,
          title: 'Chưa có quán yêu thích',
          subtitle: 'Hãy lưu những quán ngon để xem lại nhanh hơn.',
        ),
      ],
    );
  }
}
