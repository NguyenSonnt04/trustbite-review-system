import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/app.dart';

void main() {
  testWidgets('renders TrustBite home screen', (tester) async {
    await tester.pumpWidget(const TrustBiteApp());

    expect(find.text('TrustBite'), findsOneWidget);
    expect(find.text('Trust in every bite'), findsOneWidget);
    expect(find.text('Verified reviews'), findsOneWidget);
  });
}
