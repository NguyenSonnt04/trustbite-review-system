'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '@/services/admin.service';
import AdminIcon from './AdminIcon';
import styles from './AdminPortal.module.css';

const restaurantPageSize = 12;
const reviewPageSize = 8;

const reviewStatusOptions = [
  { value: 'ALL', label: 'Tất cả công khai' },
  { value: 'VERIFIED', label: 'Đã xác minh' },
  { value: 'REFERENCE_ONLY', label: 'Tham khảo' },
];

const formatDate = (value) => {
  if (!value) return 'Chưa có ngày';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatRating = (value) => {
  const rating = Number(value);
  return Number.isFinite(rating) ? rating.toFixed(1) : '—';
};

const formatReviewStatus = (status) => (
  status === 'VERIFIED'
    ? { label: 'Đã xác minh', tone: 'success' }
    : { label: 'Tham khảo', tone: 'warning' }
);

function Badge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function RestaurantThumbnail({ restaurant, onImageError }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const fallback = (
    <span aria-hidden="true" className={styles.reviewRestaurantFallback}>
      {restaurant.name?.trim()?.slice(0, 1).toUpperCase() || 'N'}
    </span>
  );

  if (!restaurant.primaryImageUrl || imageFailed) {
    return fallback;
  }

  return (
    <span className={styles.reviewRestaurantThumbnail}>
      {!imageLoaded && fallback}
      <Image
        alt=""
        className={`${styles.reviewRestaurantImage} ${imageLoaded ? styles.reviewRestaurantImageLoaded : ''}`}
        height={44}
        onError={() => {
          setImageFailed(true);
          onImageError(restaurant);
        }}
        onLoad={() => setImageLoaded(true)}
        src={restaurant.primaryImageUrl}
        unoptimized
        width={44}
      />
    </span>
  );
}

function RestaurantListItem({
  restaurant,
  active,
  onImageError,
  onSelect,
}) {
  return (
    <button
      aria-pressed={active}
      className={`${styles.reviewRestaurantItem} ${active ? styles.reviewRestaurantItemActive : ''}`}
      onClick={onSelect}
      type="button"
    >
      <RestaurantThumbnail
        key={`${restaurant.primaryImageUrl || restaurant.id}:${restaurant.imageRevision || 0}`}
        onImageError={onImageError}
        restaurant={restaurant}
      />
      <span className={styles.reviewRestaurantCopy}>
        <strong>{restaurant.name}</strong>
        <small>{restaurant.address || 'Địa chỉ chưa cập nhật'}</small>
      </span>
      <AdminIcon name="arrow" size={16} />
    </button>
  );
}

function ReviewCard({ review }) {
  const status = formatReviewStatus(review.status);
  const reactions = review.reactionCounts || {};
  const ratingRows = [
    ['Món ăn', review.foodRating],
    ['Giá cả', review.priceRating],
    ['Phục vụ', review.serviceRating],
    ['Không gian', review.ambienceRating],
  ];

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewCardHeader}>
        <div className={styles.reviewAuthor}>
          {review.reviewerAvatarUrl ? (
            <Image
              alt=""
              className={styles.reviewAuthorAvatar}
              height={40}
              src={review.reviewerAvatarUrl}
              unoptimized
              width={40}
            />
          ) : (
            <span className={styles.reviewAuthorFallback}>
              {review.reviewerDisplayName?.trim()?.slice(0, 1).toUpperCase() || 'N'}
            </span>
          )}
          <div>
            <strong>{review.reviewerDisplayName || 'Người dùng TrustBite'}</strong>
            <span>Đã ghé ngày {formatDate(review.visitedAt || review.createdAt)}</span>
          </div>
        </div>
        <div className={styles.reviewHeadline}>
          <strong>{formatRating(review.averageRating)}</strong>
          <span>/ 5</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <p className={styles.reviewComment}>{review.comment}</p>

      <div className={styles.reviewRatingGrid} aria-label="Chi tiết điểm đánh giá">
        {ratingRows.map(([label, rating]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{formatRating(rating)}</strong>
          </div>
        ))}
      </div>

      <div className={styles.reviewCardFooter}>
        <span>Đăng ngày {formatDate(review.createdAt)}</span>
        <div aria-label="Lượt tương tác">
          <span>Yêu thích {Number(reactions.LOVE || 0)}</span>
          <span>Haha {Number(reactions.HAHA || 0)}</span>
          <span>Phẫn nộ {Number(reactions.ANGRY || 0)}</span>
        </div>
      </div>
    </article>
  );
}

export default function AdminReviewsSection() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewStatus, setReviewStatus] = useState('ALL');
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const restaurantRequestSequence = useRef(0);
  const reviewRequestSequence = useRef(0);
  const selectedRestaurantId = useRef(null);
  const restaurantQuery = useRef({ page: restaurantPage, search: restaurantSearch });
  const imageRetryTimes = useRef(new Map());
  const pendingImageRefreshIds = useRef(new Set());
  const imageRefreshTimer = useRef(null);
  const imageRefreshInFlight = useRef(false);

  useEffect(() => {
    restaurantQuery.current = { page: restaurantPage, search: restaurantSearch };
  }, [restaurantPage, restaurantSearch]);

  useEffect(() => {
    const sequence = restaurantRequestSequence.current + 1;
    restaurantRequestSequence.current = sequence;
    const timer = setTimeout(async () => {
      setRestaurantsLoading(true);
      setRestaurantError('');
      try {
        const result = await adminService.listRestaurants({
          keyword: restaurantSearch,
          page: restaurantPage,
          pageSize: restaurantPageSize,
          status: 'ACTIVE',
        });
        if (sequence !== restaurantRequestSequence.current) return;
        const items = result.items || [];
        setRestaurants(items);
        setRestaurantTotal(result.total || 0);
        const nextSelectedRestaurant = (
          items.find((restaurant) => restaurant.id === selectedRestaurantId.current)
          || items[0]
          || null
        );
        if (nextSelectedRestaurant?.id !== selectedRestaurantId.current) {
          setReviewPage(1);
        }
        selectedRestaurantId.current = nextSelectedRestaurant?.id || null;
        setSelectedRestaurant(nextSelectedRestaurant);
      } catch (error) {
        if (sequence !== restaurantRequestSequence.current) return;
        setRestaurants([]);
        setRestaurantTotal(0);
        selectedRestaurantId.current = null;
        setSelectedRestaurant(null);
        setRestaurantError(error.message);
      } finally {
        if (sequence === restaurantRequestSequence.current) setRestaurantsLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [reloadVersion, restaurantPage, restaurantSearch]);

  useEffect(() => () => {
    if (imageRefreshTimer.current) clearTimeout(imageRefreshTimer.current);
    pendingImageRefreshIds.current.clear();
  }, []);

  useEffect(() => {
    if (!selectedRestaurant?.id) {
      return undefined;
    }

    const sequence = reviewRequestSequence.current + 1;
    reviewRequestSequence.current = sequence;
    const timer = setTimeout(() => {
      setReviewsLoading(true);
      setReviewError('');
      adminService.listRestaurantReviews(selectedRestaurant.id, {
        status: reviewStatus,
        page: reviewPage,
        pageSize: reviewPageSize,
      }).then((result) => {
        if (sequence !== reviewRequestSequence.current) return;
        setReviews(result.items || []);
        setReviewTotal(result.total || 0);
      }).catch((error) => {
        if (sequence !== reviewRequestSequence.current) return;
        setReviews([]);
        setReviewTotal(0);
        setReviewError(error.message);
      }).finally(() => {
        if (sequence === reviewRequestSequence.current) setReviewsLoading(false);
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      reviewRequestSequence.current += 1;
    };
  }, [reloadVersion, reviewPage, reviewStatus, selectedRestaurant?.id]);

  const restaurantPageCount = Math.max(1, Math.ceil(restaurantTotal / restaurantPageSize));
  const reviewPageCount = Math.max(1, Math.ceil(reviewTotal / reviewPageSize));
  const averageOnPage = useMemo(() => {
    const ratings = reviews
      .map((review) => Number(review.averageRating))
      .filter(Number.isFinite);
    if (ratings.length === 0) return '—';
    return (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1);
  }, [reviews]);

  const selectRestaurant = (restaurant) => {
    selectedRestaurantId.current = restaurant.id;
    setSelectedRestaurant(restaurant);
    setReviewPage(1);
    setReviewError('');
  };

  const scheduleImageRefresh = () => {
    if (
      pendingImageRefreshIds.current.size === 0
      || imageRefreshTimer.current
      || imageRefreshInFlight.current
    ) {
      return;
    }

    imageRefreshTimer.current = setTimeout(async () => {
      imageRefreshTimer.current = null;
      imageRefreshInFlight.current = true;
      const retryIds = [...pendingImageRefreshIds.current];
      pendingImageRefreshIds.current.clear();
      const retryStartedAt = Date.now();
      retryIds.forEach((restaurantId) => {
        imageRetryTimes.current.set(restaurantId, retryStartedAt);
      });
      try {
        const { page, search } = restaurantQuery.current;
        const result = await adminService.listRestaurants({
          keyword: search,
          page,
          pageSize: restaurantPageSize,
          status: 'ACTIVE',
        });
        const refreshedRestaurants = new Map(
          (result.items || []).map((item) => [item.id, item]),
        );
        setRestaurants((current) => current.map((item) => {
          const refreshed = refreshedRestaurants.get(item.id);
          return refreshed
            ? { ...refreshed, imageRevision: (item.imageRevision || 0) + 1 }
            : item;
        }));
        setSelectedRestaurant((current) => (
          current && refreshedRestaurants.has(current.id)
            ? {
                ...refreshedRestaurants.get(current.id),
                imageRevision: (current.imageRevision || 0) + 1,
              }
            : current
        ));
      } catch {
        // The thumbnail remains on its local fallback until a later manual refresh.
      } finally {
        imageRefreshInFlight.current = false;
        scheduleImageRefresh();
      }
    }, 200);
  };

  const handleRestaurantImageError = (restaurant) => {
    if (!restaurant.primaryImageUrl) return;
    const lastRetryAt = imageRetryTimes.current.get(restaurant.id) || 0;
    if (Date.now() - lastRetryAt < 60_000) return;
    pendingImageRefreshIds.current.add(restaurant.id);
    scheduleImageRefresh();
  };

  return (
    <section className={styles.reviewManagement}>
      <div className={styles.reviewOverview}>
        <div>
          <span className={styles.eyebrow}>Nội dung cộng đồng</span>
          <h2>Đánh giá theo nhà hàng</h2>
          <p>Chọn một nhà hàng để xem toàn bộ bình luận công khai của người dùng.</p>
        </div>
        <button
          aria-label="Tải lại dữ liệu đánh giá"
          className={styles.iconButton}
          disabled={restaurantsLoading || reviewsLoading}
          onClick={() => setReloadVersion((current) => current + 1)}
          type="button"
        >
          <AdminIcon name="refresh" size={18} />
        </button>
      </div>

      <div className={styles.reviewScopeNotice}>
        <AdminIcon name="info" size={18} />
        <span>
          Hiện chỉ đọc các đánh giá công khai đã xác minh hoặc dùng để tham khảo.
          Nội dung riêng tư, bị từ chối, ẩn, đã xóa và đang chờ xử lý cần API kiểm duyệt riêng từ server.
        </span>
      </div>

      <div className={styles.reviewWorkspace}>
        <aside className={styles.reviewRestaurantPanel}>
          <div className={styles.reviewRestaurantPanelHeader}>
            <div>
              <strong>Nhà hàng</strong>
              <span>{restaurantTotal} địa điểm</span>
            </div>
            <Badge>{restaurantPage}/{restaurantPageCount}</Badge>
          </div>

          <label className={styles.reviewSearch}>
            <AdminIcon name="search" size={17} />
            <input
              aria-label="Tìm nhà hàng để xem đánh giá"
              onChange={(event) => {
                setRestaurantSearch(event.target.value);
                setRestaurantPage(1);
                setReviewPage(1);
              }}
              placeholder="Tìm tên hoặc địa chỉ"
              type="search"
              value={restaurantSearch}
            />
          </label>

          {restaurantError && <div className={styles.reviewInlineError}>{restaurantError}</div>}
          <div className={styles.reviewRestaurantList}>
            {restaurantsLoading && <div className={styles.reviewListState}>Đang tải nhà hàng...</div>}
            {!restaurantsLoading && restaurants.map((restaurant) => (
              <RestaurantListItem
                active={selectedRestaurant?.id === restaurant.id}
                key={restaurant.id}
                onImageError={handleRestaurantImageError}
                onSelect={() => selectRestaurant(restaurant)}
                restaurant={restaurant}
              />
            ))}
            {!restaurantsLoading && restaurants.length === 0 && (
              <div className={styles.reviewListState}>Không tìm thấy nhà hàng phù hợp.</div>
            )}
          </div>

          <div className={styles.reviewPanelPagination}>
            <button
              className={styles.secondaryButton}
              disabled={restaurantsLoading || restaurantPage <= 1}
              onClick={() => setRestaurantPage((current) => current - 1)}
              type="button"
            >
              Trước
            </button>
            <button
              className={styles.secondaryButton}
              disabled={restaurantsLoading || restaurantPage >= restaurantPageCount}
              onClick={() => setRestaurantPage((current) => current + 1)}
              type="button"
            >
              Sau
            </button>
          </div>
        </aside>

        <div className={styles.reviewContentPanel}>
          {selectedRestaurant ? (
            <>
              <div className={styles.reviewContentHeader}>
                <div>
                  <span className={styles.eyebrow}>Đang xem</span>
                  <h3>{selectedRestaurant.name}</h3>
                  <p>{selectedRestaurant.address || 'Địa chỉ chưa cập nhật'}</p>
                </div>
                <label className={styles.reviewStatusFilter}>
                  <span>Trạng thái</span>
                  <select
                    onChange={(event) => {
                      setReviewStatus(event.target.value);
                      setReviewPage(1);
                    }}
                    value={reviewStatus}
                  >
                    {reviewStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.reviewStats}>
                <div><span>Tổng phù hợp</span><strong>{reviewTotal}</strong></div>
                <div><span>Điểm trang hiện tại</span><strong>{averageOnPage}</strong></div>
                <div><span>Điểm tin cậy nhà hàng</span><strong>{formatRating(selectedRestaurant.trustScore)}</strong></div>
              </div>

              {reviewError && <div className={styles.reviewInlineError}>{reviewError}</div>}
              <div className={styles.reviewList}>
                {reviewsLoading && <div className={styles.reviewEmptyState}>Đang tải bình luận...</div>}
                {!reviewsLoading && reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
                {!reviewsLoading && !reviewError && reviews.length === 0 && (
                  <div className={styles.reviewEmptyState}>
                    <span><AdminIcon name="reviews" size={22} /></span>
                    <strong>Chưa có đánh giá phù hợp</strong>
                    <p>Thử chọn trạng thái khác hoặc một nhà hàng khác.</p>
                  </div>
                )}
              </div>

              <div className={styles.pagination}>
                <span>Trang đánh giá {reviewPage} / {reviewPageCount}</span>
                <div>
                  <button
                    className={styles.secondaryButton}
                    disabled={reviewsLoading || reviewPage <= 1}
                    onClick={() => setReviewPage((current) => current - 1)}
                    type="button"
                  >
                    Trước
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={reviewsLoading || reviewPage >= reviewPageCount}
                    onClick={() => setReviewPage((current) => current + 1)}
                    type="button"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.reviewEmptyState}>
              <span><AdminIcon name="store" size={22} /></span>
              <strong>Chọn một nhà hàng</strong>
              <p>Danh sách bình luận sẽ xuất hiện tại đây.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
