import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';

void main() {
  testWidgets('renders a clipped network image with semantic label',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: OptimizedNetworkImage(
          imageUrl: 'https://example.test/restaurant.jpg',
          width: 120,
          height: 80,
          borderRadius: 16,
          semanticLabel: 'Restaurant photo',
        ),
      ),
    );

    final image = tester.widget<Image>(find.byType(Image));
    final clip = tester.widget<ClipRRect>(find.byType(ClipRRect));

    expect(image.semanticLabel, 'Restaurant photo');
    expect(image.width, 120);
    expect(image.height, 80);
    expect(clip.borderRadius, BorderRadius.circular(16));
  });
}
