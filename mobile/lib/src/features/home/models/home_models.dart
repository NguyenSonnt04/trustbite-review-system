class HomeRestaurant {
  const HomeRestaurant({
    required this.name,
    required this.rating,
    required this.distance,
    required this.status,
    required this.image,
    required this.featured,
  });

  final String name;
  final String rating;
  final String distance;
  final String status;
  final String image;
  final bool featured;
}

class HomeServiceShortcut {
  const HomeServiceShortcut({
    required this.iconAsset,
    required this.label,
  });

  final String iconAsset;
  final String label;
}

class HomeTrustedPick {
  const HomeTrustedPick({
    required this.restaurantName,
    required this.dishName,
    required this.rating,
    required this.distance,
    required this.image,
    required this.badges,
  });

  final String restaurantName;
  final String dishName;
  final String rating;
  final String distance;
  final String image;
  final List<String> badges;
}

class HomeReviewSnippet {
  const HomeReviewSnippet({
    required this.reviewerName,
    required this.dishName,
    required this.restaurantName,
    required this.rating,
    required this.summary,
    required this.badges,
    required this.timeAgo,
  });

  final String reviewerName;
  final String dishName;
  final String restaurantName;
  final String rating;
  final String summary;
  final List<String> badges;
  final String timeAgo;
}
