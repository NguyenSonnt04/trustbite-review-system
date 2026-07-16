import { api } from './api';
import { createIdempotencyKey } from './idempotency';

const listImages = (restaurantId) => (
  api.get(`/restaurants/${restaurantId}/images`, { cache: 'no-store' })
);

const uploadImage = ({
  restaurantId,
  file,
  caption = '',
  isPrimary = true,
  idempotencyKey = createIdempotencyKey(),
}) => {
  const body = new FormData();
  body.append('restaurantImage', file);
  if (caption.trim()) body.append('caption', caption.trim());
  body.append('isPrimary', String(isPrimary));
  return api.post(`/restaurants/${restaurantId}/images`, body, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
};

const deleteImage = (
  restaurantId,
  imageId,
  idempotencyKey = createIdempotencyKey(),
) => (
  api.delete(`/restaurants/${restaurantId}/images/${imageId}`, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  })
);

export const restaurantMediaService = {
  listImages,
  uploadImage,
  deleteImage,
};
