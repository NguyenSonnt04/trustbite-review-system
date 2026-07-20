import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { getDatabaseSslConfig } from '../src/config/dbSsl.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const latitude = parseCoordinate(
  process.argv[2] ?? process.env.MAP_DEMO_LATITUDE ?? '10.836012',
  'latitude',
  -90,
  90,
);
const longitude = parseCoordinate(
  process.argv[3] ?? process.env.MAP_DEMO_LONGITUDE ?? '106.750778',
  'longitude',
  -180,
  180,
);

const requiredEnv = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  throw new Error(`Missing database configuration: ${missingEnv.join(', ')}`);
}

const restaurants = [
  {
    slug: 'trustbite-map-demo-bep-nha',
    name: 'TrustBite Demo • Bếp Nhà',
    description: 'Món Việt gia đình, dữ liệu mẫu dành cho bản đồ phát triển.',
    latitude: latitude + 0.0024,
    longitude: longitude - 0.0018,
    trustScore: 4.8,
    verifiedReviewCount: 128,
    imageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=82',
  },
  {
    slug: 'trustbite-map-demo-pho-nong',
    name: 'TrustBite Demo • Phở Nóng 24',
    description: 'Phở bò và món nước, dữ liệu mẫu dành cho bản đồ phát triển.',
    latitude: latitude - 0.0021,
    longitude: longitude + 0.0026,
    trustScore: 4.7,
    verifiedReviewCount: 86,
    imageUrl:
      'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=640&q=82',
  },
  {
    slug: 'trustbite-map-demo-com-nieu',
    name: 'TrustBite Demo • Cơm Niêu',
    description: 'Cơm niêu Việt, dữ liệu mẫu dành cho bản đồ phát triển.',
    latitude: latitude + 0.0012,
    longitude: longitude + 0.0032,
    trustScore: 4.6,
    verifiedReviewCount: 64,
    imageUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=82',
  },
  {
    slug: 'trustbite-map-demo-ca-phe',
    name: 'TrustBite Demo • Cà Phê Bờ Sông',
    description: 'Cà phê và món nhẹ, dữ liệu mẫu dành cho bản đồ phát triển.',
    latitude: latitude - 0.003,
    longitude: longitude - 0.0022,
    trustScore: 4.5,
    verifiedReviewCount: 42,
    imageUrl:
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=640&q=82',
  },
];

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number.parseInt(process.env.DATABASE_PORT, 10),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: getDatabaseSslConfig(),
  max: 1,
  connectionTimeoutMillis: 5000,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const restaurant of restaurants) {
    const result = await client.query(
      `
        INSERT INTO restaurants (
          name,
          slug,
          description,
          address,
          latitude,
          longitude,
          geo,
          status,
          trust_score,
          verified_review_count,
          reference_review_count,
          is_deleted,
          deleted_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::numeric,
          $6::numeric,
          ST_SetSRID(
            ST_MakePoint(
              ($6::numeric)::double precision,
              ($5::numeric)::double precision
            ),
            4326
          )::geography,
          'ACTIVE',
          $7,
          $8,
          0,
          FALSE,
          NULL
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          address = EXCLUDED.address,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          geo = EXCLUDED.geo,
          status = 'ACTIVE',
          trust_score = EXCLUDED.trust_score,
          verified_review_count = EXCLUDED.verified_review_count,
          is_deleted = FALSE,
          deleted_at = NULL,
          updated_at = NOW()
        RETURNING id
      `,
      [
        restaurant.name,
        restaurant.slug,
        restaurant.description,
        'Dữ liệu demo quanh vị trí giả lập',
        restaurant.latitude,
        restaurant.longitude,
        restaurant.trustScore,
        restaurant.verifiedReviewCount,
      ],
    );
    const restaurantId = result.rows[0].id;
    await client.query(
      `
        UPDATE restaurant_images
        SET is_primary = FALSE
        WHERE restaurant_id = $1
          AND branch_id IS NULL
      `,
      [restaurantId],
    );
    const imageResult = await client.query(
      `
        SELECT id
        FROM restaurant_images
        WHERE restaurant_id = $1
          AND branch_id IS NULL
          AND image_url = $2
        LIMIT 1
      `,
      [restaurantId, restaurant.imageUrl],
    );
    if (imageResult.rows.length > 0) {
      await client.query(
        'UPDATE restaurant_images SET is_primary = TRUE WHERE id = $1',
        [imageResult.rows[0].id],
      );
    } else {
      await client.query(
        `
          INSERT INTO restaurant_images (
            restaurant_id,
            branch_id,
            image_url,
            caption,
            is_primary
          )
          VALUES ($1, NULL, $2, $3, TRUE)
        `,
        [restaurantId, restaurant.imageUrl, `${restaurant.name} cover`],
      );
    }
  }
  await client.query('COMMIT');
  console.log(
    `Seeded ${restaurants.length} map demo restaurants around ${latitude}, ${longitude}.`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}

function parseCoordinate(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}
