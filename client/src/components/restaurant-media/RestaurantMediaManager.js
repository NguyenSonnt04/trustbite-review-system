'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createIdempotencyKey } from '@/services/idempotency';
import { restaurantMediaService } from '@/services/restaurant-media.service';
import styles from './RestaurantMediaManager.module.css';

function SignedImage({ alt, src }) {
  // Signed private S3 URLs must bypass the Next.js image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={src} />;
}

export default function RestaurantMediaManager({ restaurant, onClose }) {
  const restaurantId = restaurant.id;
  const [images, setImages] = useState([]);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const uploadAttemptRef = useRef(null);
  const deleteKeysRef = useRef(new Map());

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await restaurantMediaService.listImages(restaurantId);
      setImages(result?.items ?? []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải ảnh nhà hàng.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    let active = true;
    restaurantMediaService.listImages(restaurantId)
      .then((result) => {
        if (active) setImages(result?.items ?? []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Không thể tải ảnh nhà hàng.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Vui lòng chọn một ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    setSaving(true);
    setError('');
    const previousAttempt = uploadAttemptRef.current;
    const idempotencyKey = previousAttempt
      && previousAttempt.restaurantId === restaurantId
      && previousAttempt.file === file
      && previousAttempt.caption === caption
      && previousAttempt.isPrimary === isPrimary
      ? previousAttempt.idempotencyKey
      : createIdempotencyKey();
    uploadAttemptRef.current = {
      restaurantId,
      file,
      caption,
      isPrimary,
      idempotencyKey,
    };
    try {
      await restaurantMediaService.uploadImage({
        restaurantId,
        file,
        caption,
        isPrimary,
        idempotencyKey,
      });
      await loadImages();
      uploadAttemptRef.current = null;
      setCaption('');
      setFile(null);
      setIsPrimary(true);
      event.currentTarget.reset();
    } catch (uploadError) {
      setError(uploadError.message || 'Không thể tải ảnh lên.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (image) => {
    const confirmed = window.confirm(
      image.isPrimary
        ? 'Xóa ảnh đại diện này? Ảnh mới nhất còn lại sẽ được chọn làm ảnh đại diện.'
        : 'Xóa ảnh này khỏi nhà hàng?',
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    const attemptKey = `${restaurantId}:${image.id}`;
    const idempotencyKey = deleteKeysRef.current.get(attemptKey) ?? createIdempotencyKey();
    deleteKeysRef.current.set(attemptKey, idempotencyKey);
    try {
      await restaurantMediaService.deleteImage(restaurantId, image.id, idempotencyKey);
      await loadImages();
      deleteKeysRef.current.delete(attemptKey);
    } catch (deleteError) {
      setError(deleteError.message || 'Không thể xóa ảnh.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.manager} aria-label={`Quản lý ảnh ${restaurant.name}`}>
      <header className={styles.header}>
        <div>
          <span>Thư viện nhà hàng</span>
          <h2>{restaurant.name}</h2>
          <p>{restaurant.address || 'Địa chỉ chưa cập nhật'}</p>
        </div>
        {onClose && <button className={styles.closeButton} onClick={onClose} type="button">Đóng</button>}
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <form className={styles.uploadForm} onSubmit={handleUpload}>
        <label>
          Ảnh mới
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={saving}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
            type="file"
          />
          <small>Tối đa 5 MB. Định dạng JPEG, PNG hoặc WebP.</small>
        </label>
        <label>
          Chú thích
          <input
            disabled={saving}
            maxLength={255}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Ví dụ: Không gian tầng một"
            type="text"
            value={caption}
          />
        </label>
        <label className={styles.checkbox}>
          <input
            checked={isPrimary}
            disabled={saving}
            onChange={(event) => setIsPrimary(event.target.checked)}
            type="checkbox"
          />
          Đặt làm ảnh đại diện
        </label>
        <button className={styles.primaryButton} disabled={saving} type="submit">
          {saving ? 'Đang xử lý...' : 'Tải ảnh lên'}
        </button>
      </form>

      <div className={styles.gallery}>
        {loading && <p className={styles.empty}>Đang tải thư viện...</p>}
        {!loading && images.map((image) => (
          <article className={styles.imageCard} key={image.id}>
            <div className={styles.imageFrame}>
              {image.imageUrl
                ? <SignedImage alt={image.caption || `Ảnh ${restaurant.name}`} src={image.imageUrl} />
                : <span>Không thể tạo URL xem ảnh</span>}
              {image.isPrimary && <strong>Ảnh đại diện</strong>}
            </div>
            <div className={styles.imageMeta}>
              <p>{image.caption || 'Không có chú thích'}</p>
              <button
                disabled={saving}
                onClick={() => handleDelete(image)}
                type="button"
              >
                Xóa ảnh
              </button>
            </div>
          </article>
        ))}
        {!loading && images.length === 0 && (
          <p className={styles.empty}>Nhà hàng chưa có ảnh.</p>
        )}
      </div>
    </section>
  );
}
