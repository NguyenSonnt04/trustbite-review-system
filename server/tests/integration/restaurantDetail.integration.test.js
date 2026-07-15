import '../helpers/env.js';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let closeDbPool;
let createRestaurant;
let createReview;
let createUser;
let query;
let requestApp;

async function cleanup({
  reviewIds = [],
  claimIds = [],
  menuItemIds = [],
  merchantIds = [],
  restaurantIds = [],
  userIds = [],
}) {
  if (reviewIds.length > 0) {
    await query('DELETE FROM reviews WHERE id = ANY($1::uuid[])', [reviewIds]);
  }
  if (menuItemIds.length > 0) {
    await query('DELETE FROM menu_items WHERE id = ANY($1::uuid[])', [menuItemIds]);
  }
  if (claimIds.length > 0) {
    await query('DELETE FROM restaurant_claims WHERE id = ANY($1::uuid[])', [claimIds]);
  }
  if (merchantIds.length > 0) {
    await query('DELETE FROM merchants WHERE id = ANY($1::uuid[])', [merchantIds]);
  }
  if (restaurantIds.length > 0) {
    await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [restaurantIds]);
  }
  if (userIds.length > 0) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  }
}

async function createMerchant(userId, overrides = {}) {
  const suffix = `${Date.now()}-${crypto.randomInt(1_000_000)}`;
  const result = await query(
    `INSERT INTO merchants (user_id, business_name, status, verified_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      userId,
      overrides.businessName ?? `Merchant ${suffix}`,
      overrides.status ?? 'ACTIVE',
      overrides.verifiedAt ?? new Date().toISOString(),
    ],
  );
  return result.rows[0];
}

async function createRestaurantClaim({ merchantId, restaurantId, status, createdAt }) {
  const result = await query(
    `INSERT INTO restaurant_claims (merchant_id, restaurant_id, status, evidence_url, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      merchantId,
      restaurantId,
      status,
      `s3://trustbite-test-evidence/${crypto.randomUUID()}`,
      createdAt,
    ],
  );
  return result.rows[0];
}

async function createDetailRestaurant(overrides = {}) {
  return createRestaurant({
    ...overrides,
    slug: overrides.slug ?? `detail-restaurant-${Date.now()}-${crypto.randomInt(1_000_000)}`,
  });
}

async function createMenuItem(restaurantId, overrides = {}) {
  const result = await query(
    `INSERT INTO menu_items (restaurant_id, name, price_default, currency, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      restaurantId,
      overrides.name ?? `Menu ${Date.now()}-${crypto.randomInt(1_000_000)}`,
      overrides.price ?? 50000,
      overrides.currency ?? 'VND',
      overrides.status ?? 'ACTIVE',
    ],
  );
  return result.rows[0];
}

describe('restaurant detail and public reviews API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createReview, createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterAll(async () => {
    if (closeDbPool) {
      await closeDbPool();
    }
  });

  it('returns RESTAURANT_NOT_FOUND for non-active and soft-deleted restaurants', async () => {
    const draft = await createDetailRestaurant({ name: `Detail Draft ${Date.now()}`, status: 'DRAFT' });
    const deleted = await createDetailRestaurant({
      name: `Detail Deleted ${Date.now()}`,
      status: 'ACTIVE',
      isDeleted: true,
    });

    try {
      const draftResponse = await requestApp()
        .get(`/api/v1/restaurants/${draft.id}`)
        .expect(404);
      expect(draftResponse.body.error.code).toBe('RESTAURANT_NOT_FOUND');

      const deletedResponse = await requestApp()
        .get(`/api/v1/restaurants/${deleted.id}`)
        .expect(404);
      expect(deletedResponse.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    } finally {
      await cleanup({ restaurantIds: [draft.id, deleted.id] });
    }
  });

  it('returns public detail with rating breakdown and the latest owner claim status', async () => {
    const restaurant = await createDetailRestaurant({ name: `Detail Ratings ${Date.now()}` });
    const reviewer = await createUser({ displayName: 'Detail Reviewer' });
    const merchantUser = await createUser({ displayName: 'Detail Merchant' });
    const merchant = await createMerchant(merchantUser.id);
    const reviewIds = [];
    const claimIds = [];

    try {
      const olderClaim = await createRestaurantClaim({
        merchantId: merchant.id,
        restaurantId: restaurant.id,
        status: 'REJECTED',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      });
      const latestClaim = await createRestaurantClaim({
        merchantId: merchant.id,
        restaurantId: restaurant.id,
        status: 'UNDER_REVIEW',
        createdAt: new Date().toISOString(),
      });
      claimIds.push(olderClaim.id, latestClaim.id);

      const verified = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        foodRating: 5,
        priceRating: 4,
        serviceRating: 3,
        ambienceRating: 2,
        status: 'VERIFIED',
        publicVisibility: 'PUBLIC',
      });
      const referenceOnly = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        foodRating: 3,
        priceRating: 3,
        serviceRating: 3,
        ambienceRating: 3,
        status: 'REFERENCE_ONLY',
        publicVisibility: 'PUBLIC',
      });
      const privateReview = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        foodRating: 1,
        priceRating: 1,
        serviceRating: 1,
        ambienceRating: 1,
        status: 'VERIFIED',
        publicVisibility: 'PRIVATE',
      });
      const hiddenReview = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        foodRating: 1,
        priceRating: 1,
        serviceRating: 1,
        ambienceRating: 1,
        status: 'HIDDEN',
        publicVisibility: 'PUBLIC',
      });
      reviewIds.push(verified.id, referenceOnly.id, privateReview.id, hiddenReview.id);

      const response = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: restaurant.id,
        name: restaurant.name,
        ownerClaimStatus: 'UNDER_REVIEW',
        ratingBreakdown: {
          avgFood: 4,
          avgPrice: 3.5,
          avgService: 3,
          avgAmbience: 2.5,
          avgOverall: 3.25,
          reviewCount: 2,
        },
      });
    } finally {
      await cleanup({
        reviewIds,
        claimIds,
        merchantIds: [merchant.id],
        restaurantIds: [restaurant.id],
        userIds: [reviewer.id, merchantUser.id],
      });
    }
  });

  it('lists public reviews with reviewer display name but no private identity fields', async () => {
    const restaurant = await createDetailRestaurant({ name: `Public Reviews ${Date.now()}` });
    const reviewer = await createUser({ displayName: 'Public Review Reader' });
    const reviewIds = [];

    try {
      const verified = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        comment: 'Visible verified review',
        status: 'VERIFIED',
        publicVisibility: 'PUBLIC',
      });
      const referenceOnly = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        comment: 'Visible reference-only review',
        status: 'REFERENCE_ONLY',
        publicVisibility: 'PUBLIC',
      });
      const rejected = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        comment: 'Rejected public review',
        status: 'REJECTED',
        publicVisibility: 'PUBLIC',
      });
      const privateReview = await createReview({
        userId: reviewer.id,
        restaurantId: restaurant.id,
        comment: 'Private verified review',
        status: 'VERIFIED',
        publicVisibility: 'PRIVATE',
      });
      reviewIds.push(verified.id, referenceOnly.id, rejected.id, privateReview.id);

      const allResponse = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .expect(200);
      const allIds = allResponse.body.items.map((item) => item.id);
      expect(allIds).toEqual(expect.arrayContaining([verified.id, referenceOnly.id]));
      expect(allIds).not.toEqual(expect.arrayContaining([rejected.id, privateReview.id]));
      expect(allResponse.body.items.every((item) => item.reviewerDisplayName === 'Public Review Reader')).toBe(true);
      for (const item of allResponse.body.items) {
        expect(item.reviewerAvatarUrl).toBeNull();
        expect(item).not.toHaveProperty('userId');
        expect(item).not.toHaveProperty('email');
        expect(item).not.toHaveProperty('phoneNumber');
        expect(item).not.toHaveProperty('cognitoSubject');
        expect(item).not.toHaveProperty('receipt');
      }
      expect(allResponse.body.total).toBe(2);

      const verifiedResponse = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .query({ status: 'VERIFIED' })
        .expect(200);
      expect(verifiedResponse.body.items.map((item) => item.id)).toEqual([verified.id]);

      const referenceResponse = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .query({ status: 'REFERENCE_ONLY' })
        .expect(200);
      expect(referenceResponse.body.items.map((item) => item.id)).toEqual([referenceOnly.id]);
    } finally {
      await cleanup({
        reviewIds,
        restaurantIds: [restaurant.id],
        userIds: [reviewer.id],
      });
    }
  });

  it('uses an anonymous fallback for reviews from deleted users', async () => {
    const restaurant = await createDetailRestaurant({ name: `Deleted Reviewer ${Date.now()}` });
    const reviewer = await createUser({ displayName: 'Must Not Leak' });
    const review = await createReview({
      userId: reviewer.id,
      restaurantId: restaurant.id,
      comment: 'Review remains public after account deletion starts',
      status: 'REFERENCE_ONLY',
      publicVisibility: 'PUBLIC',
    });

    try {
      await query(
        `UPDATE users
         SET status = 'DELETED',
             display_name = 'Must Not Leak',
             avatar_url = 'https://private.example/must-not-leak.png'
         WHERE id = $1`,
        [reviewer.id],
      );

      const response = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          id: review.id,
          reviewerDisplayName: 'Người dùng TrustBite',
          reviewerAvatarUrl: null,
        }),
      ]);
      expect(JSON.stringify(response.body)).not.toContain('Must Not Leak');
      expect(JSON.stringify(response.body)).not.toContain('private.example');
    } finally {
      await cleanup({
        reviewIds: [review.id],
        restaurantIds: [restaurant.id],
        userIds: [reviewer.id],
      });
    }
  });

  it('rejects public review pageSize values above 100', async () => {
    const restaurant = await createDetailRestaurant({ name: `Review Page Size ${Date.now()}` });

    try {
      const response = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .query({ pageSize: '101' })
        .expect(422);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'pageSize must be at most 100.',
      });
    } finally {
      await cleanup({ restaurantIds: [restaurant.id] });
    }
  });

  it('lists active menu items in stable order with default prices', async () => {
    const restaurant = await createDetailRestaurant({ name: `Public Menu ${Date.now()}` });
    const menuItemIds = [];

    try {
      const second = await createMenuItem(restaurant.id, {
        name: 'Bún bò',
        price: 65000,
      });
      const first = await createMenuItem(restaurant.id, {
        name: 'Bánh cuốn',
        price: 45000,
      });
      const archived = await createMenuItem(restaurant.id, {
        name: 'Món đã ẩn',
        price: 10000,
        status: 'ARCHIVED',
      });
      menuItemIds.push(second.id, first.id, archived.id);

      const response = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/menu`)
        .expect(200);

      expect(response.body).toEqual({
        items: [
          { id: first.id, name: 'Bánh cuốn', price: 45000, currency: 'VND' },
          { id: second.id, name: 'Bún bò', price: 65000, currency: 'VND' },
        ],
        page: 1,
        pageSize: 50,
        total: 2,
      });
    } finally {
      await cleanup({ menuItemIds, restaurantIds: [restaurant.id] });
    }
  });

  it('returns an empty menu and rejects menus for non-public restaurants', async () => {
    const active = await createDetailRestaurant({ name: `Empty Menu ${Date.now()}` });
    const draft = await createDetailRestaurant({
      name: `Draft Menu ${Date.now()}`,
      status: 'DRAFT',
    });

    try {
      const emptyResponse = await requestApp()
        .get(`/api/v1/restaurants/${active.id}/menu`)
        .expect(200);
      expect(emptyResponse.body.items).toEqual([]);
      expect(emptyResponse.body.total).toBe(0);

      const hiddenResponse = await requestApp()
        .get(`/api/v1/restaurants/${draft.id}/menu`)
        .expect(404);
      expect(hiddenResponse.body.error.code).toBe('NOT_FOUND');
    } finally {
      await cleanup({ restaurantIds: [active.id, draft.id] });
    }
  });
});
