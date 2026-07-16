import '../helpers/env.js';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let closeDbPool;
let query;
let requestApp;

async function cleanupRestaurants(restaurantIds) {
  if (restaurantIds.length === 0) return;
  await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [restaurantIds]);
}

async function createSearchRestaurant(overrides = {}) {
  const suffix = `${Date.now()}-${crypto.randomInt(1_000_000)}`;
  const latitude = overrides.latitude ?? null;
  const longitude = overrides.longitude ?? null;
  const trustScore = Object.prototype.hasOwnProperty.call(overrides, 'trustScore')
    ? overrides.trustScore
    : 5.0;
  const result = await query(
    `
    INSERT INTO restaurants (
      name, slug, description, phone_number, address,
      latitude, longitude, geo, status, trust_score,
      verified_review_count, reference_review_count, is_deleted
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6::numeric, $7::numeric,
      CASE WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint($7::numeric, $6::numeric), 4326)
           ELSE NULL
      END,
      $8, $9::numeric, $10, $11, $12
    )
    RETURNING *
    `,
    [
      overrides.name ?? `Search Restaurant ${suffix}`,
      overrides.slug ?? `search-restaurant-${suffix}`,
      overrides.description ?? null,
      overrides.phoneNumber ?? null,
      overrides.address ?? 'Search Test Street',
      latitude,
      longitude,
      overrides.status ?? 'ACTIVE',
      trustScore,
      overrides.verifiedReviewCount ?? 0,
      overrides.referenceReviewCount ?? 0,
      overrides.isDeleted ?? false,
    ],
  );
  return result.rows[0];
}

describe('restaurant search API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterAll(async () => {
    if (closeDbPool) {
      await closeDbPool();
    }
  });

  it('rejects malformed latitude values instead of partially parsing them', async () => {
    const response = await requestApp()
      .get('/api/v1/restaurants')
      .query({ lat: '1abc', lng: '106.7009' })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'lat must be a valid latitude.',
    });
  });

  it.each([
    [{ lat: '10.7769' }, 'lat and lng must be supplied together.'],
    [{ radiusMeters: '1000' }, 'radiusMeters requires lat and lng.'],
    [{ lat: '10.7769', lng: '106.7009', radiusMeters: '50001' }, 'radiusMeters must be an integer from 1 to 50000.'],
    [{ minTrustScore: '5.5' }, 'minTrustScore must be a decimal from 0 to 5.'],
    [{ sort: 'rating' }, 'sort must be name, trustScoreDesc, or distanceAsc.'],
    [{ sort: 'distanceAsc' }, 'distanceAsc requires lat and lng.'],
    [{ pageSize: '101' }, 'pageSize must be at most 100.'],
  ])('rejects invalid restaurant search query %j', async (queryParams, message) => {
    const response = await requestApp()
      .get('/api/v1/restaurants')
      .query(queryParams)
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message,
    });
  });

  it('returns only active, non-deleted restaurants from public search', async () => {
    const token = `Public Search ${Date.now()}`;
    const active = await createSearchRestaurant({ name: `${token} Active`, status: 'ACTIVE' });
    const draft = await createSearchRestaurant({ name: `${token} Draft`, status: 'DRAFT' });
    const deleted = await createSearchRestaurant({ name: `${token} Deleted`, status: 'ACTIVE', isDeleted: true });

    try {
      const response = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: token })
        .expect(200);

      expect(response.body.items.map((item) => item.id)).toEqual([active.id]);
      expect(response.body.total).toBe(1);
    } finally {
      await cleanupRestaurants([active.id, draft.id, deleted.id]);
    }
  });

  it('returns the newest restaurant-level primary image and null when absent', async () => {
    const token = `Image Search ${Date.now()}`;
    const withImage = await createSearchRestaurant({ name: `${token} With Image` });
    const withoutImage = await createSearchRestaurant({ name: `${token} Without Image` });
    const olderUrl = 'https://cdn.trustbite.test/restaurants/older.jpg';
    const newestUrl = 'https://cdn.trustbite.test/restaurants/newest.jpg';

    try {
      await query(
        `
        INSERT INTO restaurant_images (
          restaurant_id, image_url, caption, is_primary, created_at
        )
        VALUES
          ($1, $2, 'Older primary', TRUE, NOW() - INTERVAL '1 minute'),
          ($1, $3, 'Newest primary', TRUE, NOW()),
          ($1, $4, 'Non-primary', FALSE, NOW() + INTERVAL '1 minute')
        `,
        [
          withImage.id,
          olderUrl,
          newestUrl,
          'https://cdn.trustbite.test/restaurants/non-primary.jpg',
        ],
      );

      const response = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: token, sort: 'name' })
        .expect(200);

      const itemsById = new Map(response.body.items.map((item) => [item.id, item]));
      expect(itemsById.get(withImage.id).primaryImageUrl).toBe(newestUrl);
      expect(itemsById.get(withoutImage.id).primaryImageUrl).toBeNull();
      expect(itemsById.get(withImage.id)).not.toHaveProperty('imageUrl');
    } finally {
      await cleanupRestaurants([withImage.id, withoutImage.id]);
    }
  });

  it('filters by keyword and PostGIS radius while returning distanceMeters', async () => {
    const token = `Radius Search ${Date.now()}`;
    const near = await createSearchRestaurant({
      name: `${token} Near`,
      latitude: 10.7769,
      longitude: 106.7009,
    });
    const far = await createSearchRestaurant({
      name: `${token} Far`,
      latitude: 10.901,
      longitude: 106.801,
    });

    try {
      const response = await requestApp()
        .get('/api/v1/restaurants')
        .query({
          keyword: token,
          lat: '10.7768',
          lng: '106.7008',
          radiusMeters: '1000',
        })
        .expect(200);

      expect(response.body.items.map((item) => item.id)).toEqual([near.id]);
      expect(response.body.items[0].distanceMeters).toEqual(expect.any(Number));
      expect(response.body.items[0].distanceMeters).toBeLessThan(1000);
    } finally {
      await cleanupRestaurants([near.id, far.id]);
    }
  });

  it('matches Vietnamese restaurant names when the keyword omits diacritics', async () => {
    const restaurant = await createSearchRestaurant({
      name: 'Bún Chả Hương Liên',
      address: '24 Lê Văn Hưu, Hà Nội',
    });
    const decomposedRestaurant = await createSearchRestaurant({
      name: 'Phở Gà Kỳ Đồng'.normalize('NFD'),
      address: 'Kỳ Đồng, Quận 3, TP.HCM',
    });

    try {
      const response = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: 'bun cha huong lien' })
        .expect(200);

      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: restaurant.id,
            name: 'Bún Chả Hương Liên',
          }),
        ]),
      );

      const decomposedResponse = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: 'pho ga ky dong' })
        .expect(200);

      expect(decomposedResponse.body.items.map((item) => item.id)).toContain(decomposedRestaurant.id);
    } finally {
      await cleanupRestaurants([restaurant.id, decomposedRestaurant.id]);
    }
  });

  it('filters by minimum trust score', async () => {
    const token = `Trust Filter ${Date.now()}`;
    const trusted = await createSearchRestaurant({ name: `${token} Trusted`, trustScore: 4.75 });
    const lowerTrust = await createSearchRestaurant({ name: `${token} Lower`, trustScore: 3.5 });
    const unrated = await createSearchRestaurant({ name: `${token} Unrated`, trustScore: null });

    try {
      const response = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: token, minTrustScore: '4' })
        .expect(200);

      expect(response.body.items.map((item) => item.id)).toEqual([trusted.id]);
      expect(response.body.total).toBe(1);
    } finally {
      await cleanupRestaurants([trusted.id, lowerTrust.id, unrated.id]);
    }
  });

  it('sorts by name, trust score descending, and distance ascending', async () => {
    const token = `Sort Case ${Date.now()}`;
    const alpha = await createSearchRestaurant({
      name: `${token} Alpha`,
      latitude: 10.7769,
      longitude: 106.7009,
      trustScore: 3.25,
    });
    const bravo = await createSearchRestaurant({
      name: `${token} Bravo`,
      latitude: 10.7869,
      longitude: 106.7109,
      trustScore: 4.75,
    });

    try {
      const byName = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: token, sort: 'name' })
        .expect(200);
      expect(byName.body.items.map((item) => item.id)).toEqual([alpha.id, bravo.id]);

      const byTrust = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: token, sort: 'trustScoreDesc' })
        .expect(200);
      expect(byTrust.body.items.map((item) => item.id)).toEqual([bravo.id, alpha.id]);

      const byDistance = await requestApp()
        .get('/api/v1/restaurants')
        .query({
          keyword: token,
          lat: '10.7768',
          lng: '106.7008',
          radiusMeters: '5000',
          sort: 'distanceAsc',
        })
        .expect(200);
      expect(byDistance.body.items.map((item) => item.id)).toEqual([alpha.id, bravo.id]);
    } finally {
      await cleanupRestaurants([alpha.id, bravo.id]);
    }
  });

  it('serves nearby map-bounds lookup before dynamic restaurant id routes', async () => {
    const token = `Nearby Search ${Date.now()}`;
    const inside = await createSearchRestaurant({
      name: `${token} Inside`,
      latitude: 10.7769,
      longitude: 106.7009,
    });
    const outside = await createSearchRestaurant({
      name: `${token} Outside`,
      latitude: 10.9,
      longitude: 106.9,
    });

    try {
      const response = await requestApp()
        .get('/api/v1/restaurants/nearby')
        .query({
          northEastLat: '10.8',
          northEastLng: '106.8',
          southWestLat: '10.7',
          southWestLng: '106.6',
        })
        .expect(200);

      expect(response.body.items.map((item) => item.id)).toContain(inside.id);
      expect(response.body.items.map((item) => item.id)).not.toContain(outside.id);
    } finally {
      await cleanupRestaurants([inside.id, outside.id]);
    }
  });

  it('rejects nearby bounds that are empty or cross the antimeridian', async () => {
    const response = await requestApp()
      .get('/api/v1/restaurants/nearby')
      .query({
        northEastLat: '10.8',
        northEastLng: '106.6',
        southWestLat: '10.7',
        southWestLng: '106.8',
      })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'nearby bounds must be a non-empty rectangle that does not cross the antimeridian.',
    });
  });
});
