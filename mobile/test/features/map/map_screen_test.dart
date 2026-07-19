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

  testWidgets(
    'keeps the nearby sheet tucked behind the persistent navigation',
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
      expect(
        find.byKey(const ValueKey('map-sheet-trust-rail')),
        findsOneWidget,
      );
      expect(find.text('Nhà hàng đáng tin gần bạn'), findsNothing);
      expect(find.text('Tìm địa điểm hoặc nhà hàng'), findsOneWidget);

      final sheet = tester.widget<DraggableScrollableSheet>(
        find.byKey(const ValueKey('map-bottom-sheet')),
      );
      expect(sheet.minChildSize, 0.12);
      expect(sheet.initialChildSize, 0.16);
      expect(sheet.maxChildSize, 0.82);
      expect(sheet.snap, isTrue);
      expect(gateway.locationRequests, 1);
    },
  );

  testWidgets('replaces the search action with a clear action after typing', (
    tester,
  ) async {
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
          locationGateway: _FakeLocationGateway(),
          mapSurfaceOverride: const ColoredBox(color: Color(0xFFE5E7EB)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('map-clear-search')), findsNothing);
    await tester.enterText(
      find.byKey(const ValueKey('map-search-field')),
      'Bún bò',
    );
    await tester.pump();

    expect(find.byKey(const ValueKey('map-clear-search')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('map-clear-search')));
    await tester.pump();
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey('map-search-field')))
          .controller
          ?.text,
      isEmpty,
    );
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
