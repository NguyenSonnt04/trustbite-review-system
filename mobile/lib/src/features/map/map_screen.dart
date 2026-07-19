import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:trustbite_mobile/src/core/api/location_api.dart';
import 'package:trustbite_mobile/src/core/api/restaurant_api.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

enum MapLocationIssue { serviceDisabled, denied, deniedForever }

class MapLocationException implements Exception {
  const MapLocationException(this.issue);
  final MapLocationIssue issue;
}

abstract class MapLocationGateway {
  Future<LocationCoordinate> currentLocation();
  Future<void> openSettings(MapLocationIssue issue);
}

class DeviceMapLocationGateway implements MapLocationGateway {
  const DeviceMapLocationGateway();

  @override
  Future<LocationCoordinate> currentLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const MapLocationException(MapLocationIssue.serviceDisabled);
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw const MapLocationException(MapLocationIssue.deniedForever);
    }
    if (permission != LocationPermission.whileInUse &&
        permission != LocationPermission.always) {
      throw const MapLocationException(MapLocationIssue.denied);
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
    return LocationCoordinate(
      latitude: position.latitude,
      longitude: position.longitude,
    );
  }

  @override
  Future<void> openSettings(MapLocationIssue issue) async {
    if (issue == MapLocationIssue.serviceDisabled) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }
}

class MapScreen extends StatefulWidget {
  const MapScreen({
    super.key,
    this.isSignedIn = false,
    this.onLogin,
    this.locationApi,
    this.restaurantApi,
    this.runtimeConfig,
    this.locationGateway,
    this.mapSurfaceOverride,
  });

  final bool isSignedIn;
  final Future<bool> Function()? onLogin;
  final LocationApi? locationApi;
  final RestaurantApi? restaurantApi;
  final MobileRuntimeConfig? runtimeConfig;
  final MapLocationGateway? locationGateway;
  final Widget? mapSurfaceOverride;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  static const Color _brand = Color(0xFFFF5E00);
  static const LocationCoordinate _fallbackCenter = LocationCoordinate(
    latitude: 10.7769,
    longitude: 106.7009,
  );

  final TextEditingController _searchController = TextEditingController();
  final DraggableScrollableController _sheetController =
      DraggableScrollableController();
  Timer? _cameraDebounce;
  MapLibreMapController? _mapController;
  late final LocationApi _locationApi;
  late final RestaurantApi _restaurantApi;
  late final MobileRuntimeConfig _config;
  late final MapLocationGateway _locationGateway;

  LocationCoordinate? _userLocation;
  LocationRoute? _route;
  MapLocationIssue? _locationIssue;
  List<LocationPlace> _places = const [];
  List<NearbyRestaurant> _restaurants = const [];
  String? _selectedRestaurantId;
  bool _initializing = true;
  bool _styleLoaded = false;
  bool _searching = false;
  bool _loadingNearby = false;
  bool _nearbyReloadPending = false;
  bool _routing = false;
  String? _error;
  double _sheetExtent = 0.16;

  @override
  void initState() {
    super.initState();
    _config = widget.runtimeConfig ?? appMobileRuntimeConfig;
    _locationApi = widget.locationApi ?? LocationApi(apiClient: appApiClient);
    _restaurantApi =
        widget.restaurantApi ?? RestaurantApi(apiClient: appApiClient);
    _locationGateway =
        widget.locationGateway ?? const DeviceMapLocationGateway();
    _sheetController.addListener(_syncSheetExtent);
    _loadLocation();
  }

  @override
  void dispose() {
    _cameraDebounce?.cancel();
    _sheetController.removeListener(_syncSheetExtent);
    _sheetController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _syncSheetExtent() {
    if (!mounted || !_sheetController.isAttached) return;
    final nextExtent = _sheetController.size;
    if ((nextExtent - _sheetExtent).abs() > 0.005) {
      setState(() => _sheetExtent = nextExtent);
    }
  }

  Future<void> _loadLocation() async {
    if (!_config.hasLocationMapConfig) {
      if (mounted) setState(() => _initializing = false);
      return;
    }
    try {
      final location = await _locationGateway.currentLocation();
      if (!mounted) return;
      setState(() {
        _userLocation = location;
        _locationIssue = null;
        _initializing = false;
      });
      final controller = _mapController;
      if (controller != null) {
        await controller.animateCamera(
          CameraUpdate.newLatLngZoom(
            LatLng(location.latitude, location.longitude),
            15,
          ),
        );
      }
    } on MapLocationException catch (exception) {
      if (!mounted) return;
      setState(() {
        _locationIssue = exception.issue;
        _initializing = false;
      });
    } on Exception {
      if (!mounted) return;
      setState(() {
        _locationIssue = MapLocationIssue.denied;
        _initializing = false;
      });
    }
  }

  void _onMapCreated(MapLibreMapController controller) {
    _mapController = controller;
    controller.onCircleTapped.add(_onRestaurantCircleTapped);
    controller.onSymbolTapped.add(_onRestaurantSymbolTapped);
  }

  Future<void> _onStyleLoaded() async {
    _styleLoaded = true;
    await _drawAnnotations();
    _scheduleNearby(immediate: true);
  }

  void _scheduleNearby({bool immediate = false}) {
    _cameraDebounce?.cancel();
    _cameraDebounce = Timer(
      immediate ? Duration.zero : const Duration(milliseconds: 500),
      _loadNearby,
    );
  }

  Future<void> _loadNearby() async {
    final controller = _mapController;
    if (!_styleLoaded || controller == null || !mounted) {
      return;
    }
    if (_loadingNearby) {
      _nearbyReloadPending = true;
      return;
    }
    _nearbyReloadPending = false;
    setState(() {
      _loadingNearby = true;
      _error = null;
    });

    late final LatLngBounds bounds;
    try {
      bounds = await controller.getVisibleRegion();
      if (bounds.northeast.latitude <= bounds.southwest.latitude ||
          bounds.northeast.longitude <= bounds.southwest.longitude) {
        if (mounted) {
          setState(() => _error = 'Khu vực bản đồ này chưa được hỗ trợ.');
        }
        return;
      }
      if (!mounted) return;
      final items = await _restaurantApi.nearbyRestaurants(
        northEastLatitude: bounds.northeast.latitude,
        northEastLongitude: bounds.northeast.longitude,
        southWestLatitude: bounds.southwest.latitude,
        southWestLongitude: bounds.southwest.longitude,
        pageSize: 100,
      );
      if (!mounted) return;
      setState(() {
        _restaurants = items;
        if (!items.any((item) => item.id == _selectedRestaurantId)) {
          _selectedRestaurantId = null;
        }
      });
      await _drawRestaurants();
    } on Exception {
      if (mounted) {
        setState(() => _error = 'Không thể tải nhà hàng trong khu vực này.');
      }
    } finally {
      final rerun = _nearbyReloadPending;
      _nearbyReloadPending = false;
      if (mounted) {
        setState(() => _loadingNearby = false);
        if (rerun) _scheduleNearby(immediate: true);
      }
    }
  }

  Future<void> _drawAnnotations() async {
    await _drawRestaurants();
    await _drawRoute();
  }

  Future<void> _drawRestaurants() async {
    final controller = _mapController;
    if (!_styleLoaded || controller == null) return;
    await controller.clearCircles();
    await controller.clearSymbols();
    if (_restaurants.isEmpty) return;
    final selectedId = _selectedRestaurantId;
    await controller.addCircles(
      _restaurants
          .map((item) {
            final selected = item.id == selectedId;
            return CircleOptions(
              geometry: LatLng(item.latitude, item.longitude),
              circleColor: selected ? '#111827' : '#FF5E00',
              circleRadius: selected ? 18 : 14,
              circleStrokeColor: selected ? '#FF5E00' : '#FFFFFF',
              circleStrokeWidth: selected ? 4 : 3,
            );
          })
          .toList(growable: false),
      _restaurantAnnotationData(),
    );
    await controller.addSymbols(
      _restaurants
          .map(
            (item) => SymbolOptions(
              geometry: LatLng(item.latitude, item.longitude),
              textField: item.trustScore?.toStringAsFixed(1) ?? '✓',
              textSize: item.id == selectedId ? 12 : 10,
              textColor: '#FFFFFF',
              textHaloColor: item.id == selectedId ? '#111827' : '#FF5E00',
              textHaloWidth: 1,
              zIndex: item.id == selectedId ? 2 : 1,
            ),
          )
          .toList(growable: false),
      _restaurantAnnotationData(),
    );
  }

  List<Map<String, dynamic>> _restaurantAnnotationData() {
    return _restaurants
        .map((item) => <String, dynamic>{'restaurantId': item.id})
        .toList(growable: false);
  }

  void _onRestaurantCircleTapped(Circle circle) {
    _selectRestaurantById(circle.data?['restaurantId']);
  }

  void _onRestaurantSymbolTapped(Symbol symbol) {
    _selectRestaurantById(symbol.data?['restaurantId']);
  }

  void _selectRestaurantById(Object? restaurantId) {
    if (restaurantId is! String) return;
    for (final restaurant in _restaurants) {
      if (restaurant.id == restaurantId) {
        _selectRestaurant(restaurant);
        return;
      }
    }
  }

  Future<void> _selectRestaurant(NearbyRestaurant restaurant) async {
    setState(() => _selectedRestaurantId = restaurant.id);
    await _drawRestaurants();
    await _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(
        LatLng(restaurant.latitude, restaurant.longitude),
        16,
      ),
    );
    if (_sheetController.isAttached && _sheetController.size < 0.50) {
      await _sheetController.animateTo(
        0.50,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _drawRoute() async {
    final controller = _mapController;
    if (!_styleLoaded || controller == null) return;
    await controller.clearLines();
    final route = _route;
    if (route == null || route.geometry.length < 2) return;
    await controller.addLine(
      LineOptions(
        geometry: route.geometry
            .map((point) => LatLng(point.latitude, point.longitude))
            .toList(growable: false),
        lineColor: '#FF5E00',
        lineWidth: 5,
        lineOpacity: 0.9,
      ),
    );
  }

  Future<void> _search() async {
    FocusScope.of(context).unfocus();
    final query = _searchController.text.trim();
    if (query.isEmpty) return;
    if (!await _ensureAuthenticated()) return;
    if (!mounted) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final places = await _locationApi.searchPlaces(
        query,
        latitude: _userLocation?.latitude,
        longitude: _userLocation?.longitude,
      );
      if (mounted) setState(() => _places = places);
    } on AuthRequiredException {
      await _handleAuthenticationRequired();
    } on Exception {
      if (mounted) setState(() => _error = 'Tìm kiếm địa điểm đang gián đoạn.');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _selectPlace(LocationPlace place) async {
    setState(() => _places = const []);
    await _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(LatLng(place.latitude, place.longitude), 15),
    );
    _scheduleNearby();
  }

  Future<void> _routeTo(NearbyRestaurant restaurant) async {
    if (!await _ensureAuthenticated()) return;
    if (!mounted) return;
    final origin = _userLocation;
    if (origin == null) {
      _showMessage('Hãy bật quyền vị trí trước khi yêu cầu chỉ đường.');
      return;
    }
    setState(() => _routing = true);
    try {
      final route = await _locationApi.calculateRoute(
        origin: origin,
        destination: LocationCoordinate(
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        ),
      );
      if (!mounted) return;
      setState(() {
        _selectedRestaurantId = restaurant.id;
        _route = route;
      });
      await _drawRoute();
      await _fitRoute(route);
    } on AuthRequiredException {
      await _handleAuthenticationRequired();
    } on Exception {
      if (mounted) _showMessage('Không thể tính tuyến đường này.');
    } finally {
      if (mounted) setState(() => _routing = false);
    }
  }

  Future<bool> _ensureAuthenticated() async {
    if (widget.isSignedIn) return true;
    return await widget.onLogin?.call() ?? false;
  }

  Future<void> _handleAuthenticationRequired() async {
    if (!mounted) return;
    final signedIn = await widget.onLogin?.call() ?? false;
    if (!mounted || signedIn) return;
    _showMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  Future<void> _fitRoute(LocationRoute route) async {
    final controller = _mapController;
    if (controller == null || route.geometry.length < 2) return;
    var minLatitude = route.geometry.first.latitude;
    var maxLatitude = minLatitude;
    var minLongitude = route.geometry.first.longitude;
    var maxLongitude = minLongitude;
    for (final point in route.geometry.skip(1)) {
      minLatitude = math.min(minLatitude, point.latitude);
      maxLatitude = math.max(maxLatitude, point.latitude);
      minLongitude = math.min(minLongitude, point.longitude);
      maxLongitude = math.max(maxLongitude, point.longitude);
    }
    await controller.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLatitude, minLongitude),
          northeast: LatLng(maxLatitude, maxLongitude),
        ),
        left: 40,
        top: 110,
        right: 40,
        bottom: 280,
      ),
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_config.hasLocationMapConfig) return _configurationError();

    final center = _userLocation ?? _fallbackCenter;
    return LayoutBuilder(
      key: const ValueKey('map-first-page'),
      builder: (context, constraints) {
        return Stack(
          fit: StackFit.expand,
          children: [
            _mapSurface(center),
            const Positioned(
              left: 0,
              top: 0,
              right: 0,
              height: 164,
              child: IgnorePointer(child: _MapTopScrim()),
            ),
            Positioned(
              left: 16,
              top: 16,
              right: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _searchField(),
                  if (_places.isNotEmpty) _placeResults(),
                ],
              ),
            ),
            Positioned(
              right: 16,
              bottom:
                  104 +
                  constraints.maxHeight * math.max(0, _sheetExtent - 0.16),
              child: _mapControls(),
            ),
            Positioned.fill(child: _nearbyBottomSheet()),
          ],
        );
      },
    );
  }

  Widget _mapSurface(LocationCoordinate center) {
    return KeyedSubtree(
      key: const ValueKey('map-surface'),
      child:
          widget.mapSurfaceOverride ??
          MapLibreMap(
            styleString: _config.locationMapStyleUri.toString(),
            initialCameraPosition: CameraPosition(
              target: LatLng(center.latitude, center.longitude),
              zoom: 14,
            ),
            onMapCreated: _onMapCreated,
            onStyleLoadedCallback: _onStyleLoaded,
            onCameraIdle: () => _scheduleNearby(),
            myLocationEnabled: _userLocation != null,
            trackCameraPosition: true,
            compassEnabled: true,
            attributionButtonPosition: AttributionButtonPosition.topRight,
            attributionButtonMargins: const math.Point<double>(12, 84),
            logoViewPosition: LogoViewPosition.topLeft,
            logoViewMargins: const math.Point<double>(12, 84),
          ),
    );
  }

  Widget _mapControls() {
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      shape: const CircleBorder(),
      child: IconButton(
        key: const ValueKey('map-recenter-button'),
        tooltip: 'Về vị trí của tôi',
        onPressed: _initializing ? null : _recenterMap,
        icon: Icon(
          _userLocation == null
              ? Icons.location_searching_rounded
              : Icons.my_location_rounded,
          color: _brand,
        ),
      ),
    );
  }

  Future<void> _recenterMap() async {
    final location = _userLocation;
    if (location == null) {
      setState(() => _initializing = true);
      await _loadLocation();
      return;
    }
    await _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(
        LatLng(location.latitude, location.longitude),
        15,
      ),
    );
  }

  Widget _nearbyBottomSheet() {
    return DraggableScrollableSheet(
      key: const ValueKey('map-bottom-sheet'),
      controller: _sheetController,
      initialChildSize: 0.16,
      minChildSize: 0.12,
      maxChildSize: 0.82,
      snap: true,
      snapSizes: const [0.16, 0.50, 0.82],
      builder: (context, scrollController) {
        return Material(
          key: const ValueKey('nearby-sheet-surface'),
          color: const Color(0xFFFEFCFA),
          elevation: 18,
          shadowColor: Colors.black.withValues(alpha: 0.24),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          clipBehavior: Clip.antiAlias,
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
            children: [
              Center(
                child: Container(
                  key: const ValueKey('map-sheet-trust-rail'),
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF9CA3AF),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              if (_sheetExtent >= 0.22) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Nhà hàng đáng tin gần bạn',
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 20,
                              height: 1.05,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            _restaurants.isEmpty
                                ? 'Di chuyển bản đồ để khám phá khu vực này.'
                                : '${_restaurants.length} nhà hàng trong vùng bản đồ',
                            style: const TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_loadingNearby)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: _brand,
                          ),
                        ),
                      )
                    else if (_restaurants.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEEE4),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${_restaurants.length}',
                          style: const TextStyle(
                            color: _brand,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                  ],
                ),
                if (_initializing) _locationProgress(),
                if (_locationIssue != null) _locationBanner(_locationIssue!),
                if (_error != null) _errorNotice(_error!),
                if (_route != null) _routeSummary(_route!),
                const SizedBox(height: 12),
                if (_restaurants.isEmpty && !_loadingNearby)
                  _emptyNearbyState()
                else
                  for (final item in _restaurants) ...[
                    _restaurantTile(item),
                    const SizedBox(height: 10),
                  ],
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _locationProgress() {
    return const Padding(
      padding: EdgeInsets.only(top: 14),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: _brand),
          ),
          SizedBox(width: 10),
          Text(
            'Đang xác định vị trí của bạn…',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _errorNotice(String message) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFBE123C)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFF881337),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyNearbyState() {
    return Container(
      key: const ValueKey('map-empty-nearby'),
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F3EF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0E4DA)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 18,
            backgroundColor: Color(0xFFFFE4D4),
            child: Icon(Icons.travel_explore_rounded, color: _brand, size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Chưa có nhà hàng. Di chuyển bản đồ rồi thử lại.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Color(0xFF4B5563),
                fontSize: 12,
                fontWeight: FontWeight.w700,
                height: 1.25,
              ),
            ),
          ),
          IconButton(
            key: const ValueKey('map-reload-area'),
            tooltip: 'Tìm lại khu vực này',
            onPressed: _loadingNearby ? null : _loadNearby,
            color: _brand,
            icon: const Icon(Icons.refresh_rounded),
            style: IconButton.styleFrom(
              backgroundColor: const Color(0xFFFFE4D4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _configurationError() {
    return const Center(
      key: ValueKey('map-configuration-error'),
      child: Padding(
        padding: EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.map_outlined, color: _brand, size: 48),
            SizedBox(height: 14),
            Text(
              'Thiếu cấu hình bản đồ.',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 8),
            Text(
              'Hãy cung cấp TRUSTBITE_LOCATION_MAP_API_KEY, '
              'TRUSTBITE_LOCATION_MAP_NAME và TRUSTBITE_AWS_REGION '
              'khi build ứng dụng.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _searchField() {
    return Material(
      key: const ValueKey('map-search-bar'),
      color: Colors.white,
      elevation: 12,
      shadowColor: Colors.black.withValues(alpha: 0.20),
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: 56,
        child: TextField(
          key: const ValueKey('map-search-field'),
          controller: _searchController,
          textInputAction: TextInputAction.search,
          onChanged: (_) => setState(() => _places = const []),
          onSubmitted: (_) => _search(),
          decoration: InputDecoration(
            hintText: 'Tìm địa điểm hoặc nhà hàng',
            hintStyle: const TextStyle(
              color: Color(0xFF7C8491),
              fontWeight: FontWeight.w600,
            ),
            prefixIcon: const Icon(Icons.search_rounded, color: _brand),
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _brand,
                      ),
                    ),
                  )
                : _searchController.text.isEmpty
                ? null
                : IconButton(
                    key: const ValueKey('map-clear-search'),
                    tooltip: 'Xóa tìm kiếm',
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _places = const []);
                    },
                    icon: const Icon(Icons.close_rounded),
                  ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 15),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
          ),
        ),
      ),
    );
  }

  Widget _placeResults() {
    return Container(
      key: const ValueKey('map-place-results'),
      constraints: const BoxConstraints(maxHeight: 240),
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.16),
            offset: const Offset(0, 10),
            blurRadius: 28,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 6),
        shrinkWrap: true,
        itemCount: _places.length,
        separatorBuilder: (_, __) => const Divider(height: 1, indent: 52),
        itemBuilder: (context, index) {
          final place = _places[index];
          return ListTile(
            dense: true,
            leading: const Icon(Icons.place_outlined, color: _brand),
            title: Text(
              place.label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            onTap: () => _selectPlace(place),
          );
        },
      ),
    );
  }

  Widget _locationBanner(MapLocationIssue issue) {
    final message = switch (issue) {
      MapLocationIssue.serviceDisabled => 'Dịch vụ vị trí đang tắt.',
      MapLocationIssue.deniedForever =>
        'Quyền vị trí đang bị chặn trong cài đặt.',
      MapLocationIssue.denied => 'Bạn chưa cấp quyền vị trí.',
    };
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF0E6),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFFD8C1)),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_off_outlined, color: _brand),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$message Bản đồ đang dùng khu vực mặc định.',
              style: const TextStyle(
                color: Color(0xFF7C2D12),
                fontWeight: FontWeight.w700,
                height: 1.25,
              ),
            ),
          ),
          TextButton(
            onPressed: issue == MapLocationIssue.denied
                ? () async {
                    setState(() => _initializing = true);
                    await _loadLocation();
                  }
                : () => _locationGateway.openSettings(issue),
            child: Text(
              issue == MapLocationIssue.denied ? 'Thử lại' : 'Cài đặt',
            ),
          ),
        ],
      ),
    );
  }

  Widget _routeSummary(LocationRoute route) {
    final distanceKm = route.distanceMeters / 1000;
    final minutes = (route.durationSeconds / 60).ceil();
    return Container(
      key: const ValueKey('map-route-summary'),
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 18,
            backgroundColor: _brand,
            child: Icon(Icons.route_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Đã có tuyến đường',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${distanceKm.toStringAsFixed(1)} km · khoảng $minutes phút',
                  style: const TextStyle(
                    color: Color(0xFFD1D5DB),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Xóa tuyến đường',
            onPressed: () async {
              setState(() => _route = null);
              await _drawRoute();
            },
            icon: const Icon(Icons.close_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _restaurantTile(NearbyRestaurant item) {
    final selected = item.id == _selectedRestaurantId;
    return Material(
      key: ValueKey('nearby-restaurant-${item.id}'),
      color: selected ? const Color(0xFFFFF7F2) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: selected ? const Color(0xFFFFA46B) : const Color(0xFFECE8E4),
          width: selected ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _selectRestaurant(item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: selected
                          ? const Color(0xFFFF5E00)
                          : const Color(0xFFFFE4D4),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.restaurant_rounded,
                      color: selected ? Colors.white : _brand,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            if (item.trustScore != null)
                              _RestaurantMeta(
                                icon: Icons.verified_rounded,
                                label:
                                    'Tin cậy ${item.trustScore!.toStringAsFixed(1)}',
                                accent: true,
                              ),
                            if (item.address?.trim().isNotEmpty == true)
                              _RestaurantMeta(
                                icon: Icons.place_outlined,
                                label: item.address!.trim(),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.chevron_right_rounded,
                    color: selected ? _brand : const Color(0xFF98A2B3),
                  ),
                ],
              ),
              if (selected) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: Color(0xFFF2D7C7)),
                ),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.verifiedReviewCount == null
                            ? 'Nhà hàng đã được xác minh'
                            : '${item.verifiedReviewCount} đánh giá đã xác minh',
                        style: const TextStyle(
                          color: Color(0xFF667085),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton.icon(
                      key: ValueKey('route-to-${item.id}'),
                      onPressed: _routing ? null : () => _routeTo(item),
                      icon: _routing
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.near_me_rounded, size: 18),
                      label: const Text('Chỉ đường'),
                      style: FilledButton.styleFrom(
                        backgroundColor: _brand,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 44),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MapTopScrim extends StatelessWidget {
  const _MapTopScrim();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x52000000), Color(0x14000000), Colors.transparent],
          stops: [0, 0.46, 1],
        ),
      ),
    );
  }
}

class _RestaurantMeta extends StatelessWidget {
  const _RestaurantMeta({
    required this.icon,
    required this.label,
    this.accent = false,
  });

  final IconData icon;
  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 190),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: accent ? const Color(0xFFFFEEE4) : const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 13,
            color: accent ? const Color(0xFFFF5E00) : const Color(0xFF6B7280),
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: accent
                    ? const Color(0xFF9A3412)
                    : const Color(0xFF6B7280),
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
