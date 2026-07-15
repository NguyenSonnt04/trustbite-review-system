'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { adminService } from '@/services/admin.service';
import AdminIcon from './AdminIcon';
import styles from './AdminPortal.module.css';

const STATUS_OPTIONS = [
  ['DRAFT', 'Bản nháp'],
  ['ACTIVE', 'Hoạt động'],
  ['SUSPENDED', 'Tạm khóa'],
  ['CLOSED', 'Đã đóng'],
];

const formatRestaurantStatus = (status) => {
  if (status === 'ACTIVE') return { label: 'Hoạt động', tone: 'success' };
  if (status === 'DRAFT') return { label: 'Bản nháp', tone: 'neutral' };
  if (status === 'SUSPENDED') return { label: 'Tạm khóa', tone: 'warning' };
  return { label: 'Đã đóng', tone: 'danger' };
};

const formatScore = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : null;
};

const sameNumbers = (left = [], right = []) => (
  [...left].map(Number).sort((a, b) => a - b).join('|')
  === [...right].map(Number).sort((a, b) => a - b).join('|')
);

function Badge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function Field({ label, ...props }) {
  return (
    <label className={styles.formField}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function RestaurantDetailModal({ restaurantId, onClose, onUpdated }) {
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadPrimary, setUploadPrimary] = useState(false);
  const [captions, setCaptions] = useState({});
  const mutationKeys = useRef(new Map());

  const imageMutationKey = (operation, file, payload = []) => {
    const fingerprint = [
      operation,
      file.name,
      file.size,
      file.type,
      file.lastModified,
      ...payload,
    ].join(':');
    if (!mutationKeys.current.has(fingerprint)) {
      mutationKeys.current.set(fingerprint, crypto.randomUUID());
    }
    return {
      fingerprint,
      idempotencyKey: mutationKeys.current.get(fingerprint),
    };
  };

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminService.getRestaurant(restaurantId);
      setRestaurant(result);
      setForm({
        name: result.name || '',
        description: result.description || '',
        address: result.address || '',
        phoneNumber: result.phoneNumber || '',
        latitude: result.latitude ?? '',
        longitude: result.longitude ?? '',
        status: result.status || 'DRAFT',
        categoryIds: result.categoryIds || [],
      });
      setCaptions(Object.fromEntries(
        (result.images || []).map((image) => [image.id, image.caption || '']),
      ));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    const timer = setTimeout(loadDetail, 0);
    return () => clearTimeout(timer);
  }, [loadDetail]);

  const changed = useMemo(() => {
    if (!restaurant || !form) return false;
    return (
      form.name !== (restaurant.name || '')
      || form.description !== (restaurant.description || '')
      || form.address !== (restaurant.address || '')
      || form.phoneNumber !== (restaurant.phoneNumber || '')
      || String(form.latitude) !== String(restaurant.latitude ?? '')
      || String(form.longitude) !== String(restaurant.longitude ?? '')
      || form.status !== restaurant.status
      || !sameNumbers(form.categoryIds, restaurant.categoryIds)
    );
  }, [form, restaurant]);

  const refreshAfterMutation = async () => {
    await loadDetail();
    await onUpdated();
  };

  const save = async (event) => {
    event.preventDefault();
    if (!changed) return;
    setSubmitting(true);
    setError('');
    try {
      const body = { reason };
      if (form.name !== (restaurant.name || '')) body.name = form.name;
      if (form.description !== (restaurant.description || '')) body.description = form.description;
      if (form.address !== (restaurant.address || '')) body.address = form.address;
      if (form.phoneNumber !== (restaurant.phoneNumber || '')) body.phoneNumber = form.phoneNumber;
      if (form.status !== restaurant.status) body.status = form.status;
      if (!sameNumbers(form.categoryIds, restaurant.categoryIds)) body.categoryIds = form.categoryIds;
      if (
        String(form.latitude) !== String(restaurant.latitude ?? '')
        || String(form.longitude) !== String(restaurant.longitude ?? '')
      ) {
        body.latitude = form.latitude === '' ? null : Number(form.latitude);
        body.longitude = form.longitude === '' ? null : Number(form.longitude);
      }
      await adminService.updateRestaurant(restaurantId, body);
      setReason('');
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const uploadImage = async (event) => {
    event.preventDefault();
    if (!uploadFile) return;
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('restaurantImage', uploadFile);
      body.set('caption', uploadCaption);
      body.set('isPrimary', String(uploadPrimary || (restaurant.images || []).length === 0));
      const mutation = imageMutationKey('upload', uploadFile, [
        uploadCaption.trim(),
        String(uploadPrimary || (restaurant.images || []).length === 0),
      ]);
      await adminService.uploadRestaurantImage(restaurantId, body, mutation.idempotencyKey);
      mutationKeys.current.delete(mutation.fingerprint);
      setUploadFile(null);
      setUploadCaption('');
      setUploadPrimary(false);
      formElement.reset();
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const replaceImage = async (image, file) => {
    if (!file) return;
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('restaurantImage', file);
      body.set('caption', captions[image.id] || '');
      const mutation = imageMutationKey(`replace:${image.id}`, file, [
        (captions[image.id] || '').trim(),
      ]);
      await adminService.replaceRestaurantImage(
        restaurantId,
        image.id,
        body,
        mutation.idempotencyKey,
      );
      mutationKeys.current.delete(mutation.fingerprint);
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateImage = async (image, body) => {
    setSubmitting(true);
    setError('');
    try {
      await adminService.updateRestaurantImage(restaurantId, image.id, body);
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeImage = async (image) => {
    const confirmed = window.confirm(
      image.isPrimary
        ? 'Xóa ảnh đại diện này? Ảnh mới nhất còn lại sẽ được chọn làm ảnh đại diện.'
        : 'Xóa ảnh này khỏi nhà hàng?',
    );
    if (!confirmed) return;
    setSubmitting(true);
    setError('');
    try {
      const fingerprint = `delete:${restaurantId}:${image.id}`;
      if (!mutationKeys.current.has(fingerprint)) {
        mutationKeys.current.set(fingerprint, crypto.randomUUID());
      }
      await adminService.deleteRestaurantImage(
        restaurantId,
        image.id,
        mutationKeys.current.get(fingerprint),
      );
      mutationKeys.current.delete(fingerprint);
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (categoryId) => {
    const exists = form.categoryIds.includes(categoryId);
    setForm({
      ...form,
      categoryIds: exists
        ? form.categoryIds.filter((id) => id !== categoryId)
        : [...form.categoryIds, categoryId],
    });
  };

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={() => {
        if (!submitting) onClose();
      }}
    >
      <section
        aria-labelledby="restaurant-detail-title"
        aria-modal="true"
        className={`${styles.modal} ${styles.restaurantDetailModal}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="restaurant-detail-title">Chi tiết nhà hàng</h2>
            <p>{restaurant ? `${restaurant.name} · ${restaurant.id}` : 'Đang tải dữ liệu'}</p>
          </div>
          <button
            aria-label="Đóng"
            className={styles.iconButton}
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <AdminIcon name="close" size={18} />
          </button>
        </header>

        <div className={styles.modalBody}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          {loading && <div className={styles.emptyInline}>Đang tải chi tiết nhà hàng...</div>}
          {!loading && restaurant && form && (
            <div className={styles.restaurantDetailLayout}>
              <form className={styles.restaurantProfileForm} onSubmit={save}>
                <div className={styles.restaurantModalSectionHeader}>
                  <div>
                    <h3>Thông tin nhà hàng</h3>
                    <p>Cập nhật hồ sơ và trạng thái hiển thị trên TrustBite.</p>
                  </div>
                  <Badge tone={formatRestaurantStatus(restaurant.status).tone}>
                    {formatRestaurantStatus(restaurant.status).label}
                  </Badge>
                </div>

                <div className={styles.formGrid}>
                  <Field
                    label="Tên nhà hàng"
                    maxLength={200}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                    value={form.name}
                  />
                  <label className={styles.formField}>
                    <span>Trạng thái</span>
                    <select
                      onChange={(event) => setForm({ ...form, status: event.target.value })}
                      value={form.status}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Địa chỉ"
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                    value={form.address}
                  />
                  <Field
                    label="Số điện thoại"
                    maxLength={30}
                    onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                    value={form.phoneNumber}
                  />
                  <Field
                    label="Vĩ độ"
                    max="90"
                    min="-90"
                    onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                    step="any"
                    type="number"
                    value={form.latitude}
                  />
                  <Field
                    label="Kinh độ"
                    max="180"
                    min="-180"
                    onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                    step="any"
                    type="number"
                    value={form.longitude}
                  />
                </div>

                <label className={styles.formField}>
                  <span>Mô tả</span>
                  <textarea
                    maxLength={5000}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    value={form.description}
                  />
                </label>

                <fieldset className={styles.roleFieldset}>
                  <legend>Danh mục</legend>
                  <div>
                    {(restaurant.availableCategories || []).map((category) => (
                      <label key={category.id}>
                        <input
                          checked={form.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          type="checkbox"
                        />
                        <span>{category.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className={styles.formField}>
                  <span>Lý do chỉnh sửa (tối thiểu 10 ký tự)</span>
                  <textarea
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Mô tả lý do và căn cứ thay đổi"
                    value={reason}
                  />
                </label>

                <div className={styles.modalFooter}>
                  <button
                    className={styles.secondaryButton}
                    disabled={submitting}
                    onClick={onClose}
                    type="button"
                  >
                    Đóng
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={!changed || reason.trim().length < 10 || submitting}
                    type="submit"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>

              <section className={styles.restaurantGallerySection}>
                <div className={styles.restaurantModalSectionHeader}>
                  <div>
                    <h3>Thư viện ảnh</h3>
                    <p>{restaurant.images?.length || 0} ảnh · JPG, PNG hoặc WebP · tối đa 5 MB</p>
                  </div>
                </div>

                <form className={styles.restaurantImageUpload} onSubmit={uploadImage}>
                  <Field
                    accept="image/jpeg,image/png,image/webp"
                    label="Chọn ảnh mới"
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                    required
                    type="file"
                  />
                  <Field
                    label="Chú thích"
                    maxLength={255}
                    onChange={(event) => setUploadCaption(event.target.value)}
                    value={uploadCaption}
                  />
                  <label className={styles.imagePrimaryToggle}>
                    <input
                      checked={uploadPrimary}
                      onChange={(event) => setUploadPrimary(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Đặt làm ảnh đại diện</span>
                  </label>
                  <button className={styles.primaryButton} disabled={!uploadFile || submitting} type="submit">
                    <AdminIcon name="upload" size={16} />
                    Thêm ảnh
                  </button>
                </form>

                <div className={styles.restaurantGalleryGrid}>
                  {(restaurant.images || []).map((image) => (
                    <article className={styles.restaurantImageCard} key={image.id}>
                      <a href={image.imageUrl} rel="noreferrer" target="_blank">
                        <Image
                          alt={image.caption || restaurant.name}
                          height={360}
                          src={image.imageUrl}
                          unoptimized
                          width={640}
                        />
                      </a>
                      <div className={styles.restaurantImageCardBody}>
                        <div className={styles.restaurantImageMeta}>
                          {image.isPrimary && <Badge tone="success">Ảnh đại diện</Badge>}
                          <span>{new Date(image.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <input
                          aria-label="Chú thích ảnh"
                          maxLength={255}
                          onChange={(event) => setCaptions({
                            ...captions,
                            [image.id]: event.target.value,
                          })}
                          value={captions[image.id] || ''}
                        />
                        <div className={styles.restaurantImageActions}>
                          <a className={styles.secondaryButton} href={image.imageUrl} rel="noreferrer" target="_blank">
                            Xem ảnh
                          </a>
                          <button
                            className={styles.secondaryButton}
                            disabled={submitting || captions[image.id] === (image.caption || '')}
                            onClick={() => updateImage(image, { caption: captions[image.id] })}
                            type="button"
                          >
                            Lưu chú thích
                          </button>
                          {!image.isPrimary && (
                            <button
                              className={styles.secondaryButton}
                              disabled={submitting}
                              onClick={() => updateImage(image, { isPrimary: true })}
                              type="button"
                            >
                              Đặt ảnh chính
                            </button>
                          )}
                          <label className={styles.secondaryButton}>
                            Thay ảnh
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              disabled={submitting}
                              hidden
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                replaceImage(image, file);
                              }}
                              type="file"
                            />
                          </label>
                          <button
                            className={styles.dangerButton}
                            disabled={submitting}
                            onClick={() => removeImage(image)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {(restaurant.images || []).length === 0 && (
                    <div className={styles.restaurantGalleryEmpty}>
                      <AdminIcon name="image" size={24} />
                      <strong>Chưa có ảnh nhà hàng</strong>
                      <p>Chọn ảnh phía trên để tạo thư viện đầu tiên.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminRestaurantsSection() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestSequence = useRef(0);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await adminService.listRestaurants({
          keyword: search,
          page,
          pageSize,
        });
        if (sequence !== requestSequence.current) return;
        setRestaurants(result.items || []);
        setTotal(result.total || 0);
      } catch (requestError) {
        if (sequence !== requestSequence.current) return;
        setRestaurants([]);
        setTotal(0);
        setError(requestError.message);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [page, reloadVersion, search]);

  const reload = async () => {
    setLoading(true);
    setReloadVersion((current) => current + 1);
  };

  return (
    <>
      <section className={`${styles.panel} ${styles.restaurantSection}`}>
        <div className={styles.tableToolbar}>
          <div className={styles.searchBox}>
            <AdminIcon name="search" size={18} />
            <input
              aria-label="Tìm nhà hàng"
              onChange={(event) => {
                setLoading(true);
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên hoặc địa chỉ"
              type="search"
              value={search}
            />
          </div>
          <div className={styles.toolbarActions}>
            <Badge>{total} nhà hàng</Badge>
            <button aria-label="Tải lại dữ liệu" className={styles.iconButton} onClick={reload} type="button">
              <AdminIcon name="refresh" size={18} />
            </button>
          </div>
        </div>

        <div className={styles.boundaryNotice}>
          <AdminIcon name="lock" size={18} />
          <span>ADMIN và SUPER_ADMIN có thể chỉnh sửa hồ sơ, trạng thái và thư viện ảnh.</span>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Nhà hàng</th>
                <th>Địa điểm</th>
                <th>Điểm tin cậy</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="5"><div className={styles.emptyInline}>Đang tải dữ liệu...</div></td></tr>
              )}
              {!loading && restaurants.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td>
                    <div className={styles.entityCell}>
                      {restaurant.primaryImageUrl ? (
                        <Image
                          alt=""
                          className={styles.restaurantTableImage}
                          height={36}
                          src={restaurant.primaryImageUrl}
                          unoptimized
                          width={36}
                        />
                      ) : (
                        <span className={styles.entityAvatar}>{restaurant.name?.slice(0, 1).toUpperCase()}</span>
                      )}
                      <div><strong>{restaurant.name}</strong><span>{restaurant.slug || restaurant.id}</span></div>
                    </div>
                  </td>
                  <td>{restaurant.address || 'Chưa cập nhật'}</td>
                  <td>
                    {formatScore(restaurant.trustScore) === null
                      ? 'Chưa có điểm'
                      : <><strong>{formatScore(restaurant.trustScore)}</strong> / 5</>}
                  </td>
                  <td>
                    <Badge tone={formatRestaurantStatus(restaurant.status).tone}>
                      {formatRestaurantStatus(restaurant.status).label}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className={styles.smallButton}
                      onClick={() => setSelectedRestaurantId(restaurant.id)}
                      type="button"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && restaurants.length === 0 && (
                <tr><td colSpan="5"><div className={styles.emptyInline}>Không tìm thấy nhà hàng phù hợp.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>Trang {page} / {pageCount}</span>
          <div>
            <button
              className={styles.secondaryButton}
              disabled={loading || page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((current) => current - 1);
              }}
              type="button"
            >
              Trước
            </button>
            <button
              className={styles.secondaryButton}
              disabled={loading || page >= pageCount}
              onClick={() => {
                setLoading(true);
                setPage((current) => current + 1);
              }}
              type="button"
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      {selectedRestaurantId && (
        <RestaurantDetailModal
          onClose={() => setSelectedRestaurantId(null)}
          onUpdated={reload}
          restaurantId={selectedRestaurantId}
        />
      )}
    </>
  );
}
