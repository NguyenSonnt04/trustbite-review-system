import '../helpers/env.js';
import { afterAll, describe, expect, it } from 'vitest';

const { createRestaurant } = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

describe('restaurant search API', () => {
  afterAll(async () => {
    await closeDbPool();
  });

  it('matches Vietnamese restaurant names when the keyword omits diacritics', async () => {
    const restaurant = await createRestaurant({
      name: 'Bún Chả Hương Liên',
      address: '24 Lê Văn Hưu, Hà Nội',
      status: 'ACTIVE',
    });
    const decomposedRestaurant = await createRestaurant({
      name: 'Phở Gà Kỳ Đồng'.normalize('NFD'),
      address: 'Kỳ Đồng, Quận 3, TP.HCM',
      status: 'ACTIVE',
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
      await deleteByIds('restaurants', 'id', [restaurant.id, decomposedRestaurant.id]);
    }
  });
});
