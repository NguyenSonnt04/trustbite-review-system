class HomeRestaurant {
  const HomeRestaurant({
    this.id,
    required this.name,
    required this.rating,
    required this.distance,
    required this.status,
    required this.image,
    required this.featured,
  });

  final String? id;
  final String name;
  final String rating;
  final String? distance;
  final String status;
  final String? image;
  final bool featured;
}

class HomeRestaurantDetail {
  const HomeRestaurantDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.address,
    required this.phoneNumber,
    required this.imageUrl,
    required this.trustScore,
    required this.verifiedReviewCount,
    required this.ratingBreakdown,
  });

  final String id;
  final String name;
  final String? description;
  final String? address;
  final String? phoneNumber;
  final String? imageUrl;
  final double? trustScore;
  final int verifiedReviewCount;
  final RestaurantRatingBreakdown ratingBreakdown;
}

class RestaurantRatingBreakdown {
  const RestaurantRatingBreakdown({
    required this.averageFood,
    required this.averagePrice,
    required this.averageService,
    required this.averageAmbience,
    required this.averageOverall,
    required this.reviewCount,
  });

  final double? averageFood;
  final double? averagePrice;
  final double? averageService;
  final double? averageAmbience;
  final double? averageOverall;
  final int reviewCount;
}

class HomeMenuItem {
  const HomeMenuItem({
    required this.id,
    required this.name,
    required this.price,
    required this.currency,
  });

  final String id;
  final String name;
  final double price;
  final String currency;
}

class HomeRestaurantReviewPage {
  const HomeRestaurantReviewPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<HomeRestaurantReview> items;
  final int page;
  final int pageSize;
  final int total;
}

enum ReviewReactionType {
  love('LOVE', '❤️', 'Yêu thích'),
  haha('HAHA', '😆', 'Haha'),
  angry('ANGRY', '😡', 'Phẫn nộ');

  const ReviewReactionType(this.apiValue, this.emoji, this.label);

  final String apiValue;
  final String emoji;
  final String label;
}

class ReviewReactionCounts {
  const ReviewReactionCounts({this.love = 0, this.haha = 0, this.angry = 0});

  final int love;
  final int haha;
  final int angry;

  int forType(ReviewReactionType type) => switch (type) {
    ReviewReactionType.love => love,
    ReviewReactionType.haha => haha,
    ReviewReactionType.angry => angry,
  };
}

class HomeRestaurantReview {
  const HomeRestaurantReview({
    required this.id,
    required this.restaurantId,
    required this.branchId,
    required this.foodRating,
    required this.priceRating,
    required this.serviceRating,
    required this.ambienceRating,
    required this.averageRating,
    required this.reviewerDisplayName,
    this.reviewerAvatarUrl,
    required this.comment,
    required this.status,
    required this.verificationStatus,
    required this.trustLabel,
    required this.visitedAt,
    required this.createdAt,
    this.reactionCounts = const ReviewReactionCounts(),
  });

  final String id;
  final String restaurantId;
  final String? branchId;
  final int foodRating;
  final int priceRating;
  final int serviceRating;
  final int ambienceRating;
  final double averageRating;
  final String reviewerDisplayName;
  final String? reviewerAvatarUrl;
  final String comment;
  final String status;
  final String verificationStatus;
  final String trustLabel;
  final DateTime? visitedAt;
  final DateTime createdAt;
  final ReviewReactionCounts reactionCounts;
}

class RestaurantMockComment {
  const RestaurantMockComment({
    required this.authorName,
    required this.rating,
    required this.comment,
    required this.timeAgo,
    required this.helpfulCount,
  });

  final String authorName;
  final double rating;
  final String comment;
  final String timeAgo;
  final int helpfulCount;
}

class HomeServiceShortcut {
  const HomeServiceShortcut({required this.iconAsset, required this.label});

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
