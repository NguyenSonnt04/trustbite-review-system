import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

const homeNotifications = [
  HomeNotification(
    title: 'Bill đã được xác thực',
    body: 'Bill tại Phở Thìn Bờ Hồ đã khớp thông tin quán và thời gian.',
    timeAgo: '5 phút trước',
    icon: 'receipt',
    unread: true,
  ),
  HomeNotification(
    title: 'Có ưu đãi gần bạn',
    body: 'Quán Nướng Sài Gòn đang có ưu đãi cho thành viên TrustBite.',
    timeAgo: '24 phút trước',
    icon: 'offer',
    unread: true,
  ),
  HomeNotification(
    title: 'Review được quan tâm',
    body: 'Review Phở bò tái chín của bạn vừa nhận thêm 8 lượt hữu ích.',
    timeAgo: '1 giờ trước',
    icon: 'review',
    unread: true,
  ),
];

const homeRestaurants = [
  HomeRestaurant(
    name: 'Phở Thìn Bờ Hồ',
    rating: '4.9',
    distance: '0.4 km',
    status: 'Đang mở',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/cbbe0b4d6e4f98216d58583a392e35400bd02888?width=480',
    featured: false,
  ),
  HomeRestaurant(
    name: 'Quán Nướng Sài Gòn',
    rating: '4.8',
    distance: '0.9 km',
    status: 'Đang mở',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/679e1d9bab013589f5dde0d20724c395e2b0ddb7?width=480',
    featured: false,
  ),
  HomeRestaurant(
    name: 'Sakura Sushi Bar',
    rating: '4.7',
    distance: '1.2 km',
    status: 'Đang mở',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/46d0a38a098d474174d9d50d228ec2814c5b19ef?width=480',
    featured: true,
  ),
  HomeRestaurant(
    name: 'Bún Bò Huế Nguyên Chất',
    rating: '4.8',
    distance: '1.6 km',
    status: 'Đang mở',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/9cc215312fb496856dc9cdb017db5c5222b9478b?width=480',
    featured: true,
  ),
];

const homeServiceShortcuts = [
  HomeServiceShortcut(
    iconAsset: 'assets/icons/scan_bill.svg.png',
    label: 'Quét bill',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/nearby.svg.png',
    label: 'Gần quán',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/summary.svg.png',
    label: 'Tóm tắt',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/compare.svg.png',
    label: 'So sánh',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/save_restaurant.svg.png',
    label: 'Lưu quán',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/report_fake.svg.png',
    label: 'Báo ảo',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/search_food.svg.png',
    label: 'Tìm món',
  ),
  HomeServiceShortcut(
    iconAsset: 'assets/icons/suggestion.svg.png',
    label: 'Gợi ý',
  ),
];

const homeTrustedPicks = [
  HomeTrustedPick(
    restaurantName: 'Phở Thìn Bờ Hồ',
    dishName: 'Phở bò tái chín',
    rating: '4.9',
    distance: '0.4 km',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/cbbe0b4d6e4f98216d58583a392e35400bd02888?width=480',
    badges: ['Có bill', 'Gần bạn'],
  ),
  HomeTrustedPick(
    restaurantName: 'Sakura Sushi Bar',
    dishName: 'Combo sashimi',
    rating: '4.7',
    distance: '1.2 km',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/46d0a38a098d474174d9d50d228ec2814c5b19ef?width=480',
    badges: ['OCR khớp', 'GPS ổn'],
  ),
  HomeTrustedPick(
    restaurantName: 'Bún Bò Huế Nguyên Chất',
    dishName: 'Bún bò đặc biệt',
    rating: '4.8',
    distance: '1.6 km',
    image:
        'https://api.builder.io/api/v1/image/assets/TEMP/9cc215312fb496856dc9cdb017db5c5222b9478b?width=480',
    badges: ['Có bill', 'Mới xác thực'],
  ),
];

const homeLatestReviews = [
  HomeReviewSnippet(
    reviewerName: 'Minh Anh',
    dishName: 'Phở bò tái chín',
    restaurantName: 'Phở Thìn Bờ Hồ',
    rating: '4.9',
    summary: 'Nước dùng đậm, thịt mềm, bill và vị trí đều khớp.',
    badges: ['Có bill', 'Đã xác thực'],
    timeAgo: '12 phút trước',
  ),
  HomeReviewSnippet(
    reviewerName: 'Đức Huy',
    dishName: 'Combo nướng',
    restaurantName: 'Quán Nướng Sài Gòn',
    rating: '4.8',
    summary: 'Phần ăn ổn, giá đúng bill, quán còn mở lúc ghé.',
    badges: ['Có bill', 'Gần quán'],
    timeAgo: '28 phút trước',
  ),
];
