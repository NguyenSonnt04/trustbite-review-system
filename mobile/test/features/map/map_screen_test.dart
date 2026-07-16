import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/location_api.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/map/map_screen.dart';

void main() {
  testWidgets(
    'shows a safe error without requesting location when map key is missing',
    (tester) async {
      final gateway = _FakeLocationGateway();
      await tester.pumpWidget(
        MaterialApp(
          home: MapScreen(
            runtimeConfig: const MobileRuntimeConfig(
              apiBaseUrl: 'http://localhost:5000',
              awsRegion: 'ap-southeast-1',
              cognitoUserPoolId: '',
              cognitoClientId: '',
              locationMapApiKey: '',
              locationMapName: 'TrustBiteMap',
            ),
            locationGateway: gateway,
          ),
        ),
      );
      await tester.pump();

      expect(
        find.byKey(const ValueKey('map-configuration-error')),
        findsOneWidget,
      );
      expect(gateway.locationRequests, 0);
    },
  );

  testWidgets('uses a full-canvas map with a snapping nearby sheet', (
    tester,
  ) async {
    final gateway = _FakeLocationGateway();
    await tester.pumpWidget(
      MaterialApp(
        home: MapScreen(
          runtimeConfig: const MobileRuntimeConfig(
            apiBaseUrl: 'http://localhost:5000',
            awsRegion: 'ap-southeast-1',
            cognitoUserPoolId: '',
            cognitoClientId: '',
            locationMapApiKey: 'test-map-key',
            locationMapName: 'TrustBiteMap',
          ),
          locationGateway: gateway,
          mapSurfaceOverride: const ColoredBox(color: Color(0xFFE5E7EB)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('map-first-page')), findsOneWidget);
    expect(find.byKey(const ValueKey('map-surface')), findsOneWidget);
    expect(find.byKey(const ValueKey('map-search-bar')), findsOneWidget);
    expect(find.byKey(const ValueKey('map-bottom-sheet')), findsOneWidget);
    expect(find.byKey(const ValueKey('map-sheet-trust-rail')), findsOneWidget);
    expect(find.text('Nearby, with confidence'), findsOneWidget);

    final sheet = tester.widget<DraggableScrollableSheet>(
      find.byKey(const ValueKey('map-bottom-sheet')),
    );
    expect(sheet.minChildSize, 0.20);
    expect(sheet.initialChildSize, 0.31);
    expect(sheet.maxChildSize, 0.76);
    expect(sheet.snap, isTrue);
    expect(gateway.locationRequests, 1);
  });
}

class _FakeLocationGateway implements MapLocationGateway {
  int locationRequests = 0;

  @override
  Future<LocationCoordinate> currentLocation() async {
    locationRequests += 1;
    return const LocationCoordinate(latitude: 10, longitude: 106);
  }

  @override
  Future<void> openSettings(MapLocationIssue issue) async {}
}
