'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
const MAX_BULK_DELETE_RESTAURANTS = 100;

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

const getOrCreateMutationKey = (keys, fingerprint) => {
  if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID());
  return keys.get(fingerprint);
};

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

function FileField({ fileName, label, ...props }) {
  const inputId = useId();
  const labelId = `${inputId}-label`;

  return (
    <div className={styles.formField}>
      <span id={labelId}>{label}</span>
      <div className={styles.filePicker}>
        <input
          {...props}
          aria-labelledby={labelId}
          className={styles.filePickerInput}
          id={inputId}
          type="file"
        />
        <label className={styles.filePickerButton} htmlFor={inputId}>
          <AdminIcon name="upload" size={15} />
          Chọn tệp
        </label>
        <span className={styles.filePickerName} title={fileName || 'Chưa chọn tệp'}>
          {fileName || 'Chưa chọn tệp'}
        </span>
      </div>
    </div>
  );
}

function SelectionCheckbox({ indeterminate = false, ...props }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <input {...props} ref={inputRef} type="checkbox" />;
}

function BulkDeleteConfirmationModal({
  count,
  deleting,
  onCancel,
  onConfirm,
  reason,
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) || [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [deleting]);

  return (
    <div
      className={styles.confirmationBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onCancel();
      }}
    >
      <section
        aria-describedby="bulk-delete-description"
        aria-labelledby="bulk-delete-title"
        aria-modal="true"
        className={styles.confirmationDialog}
        ref={dialogRef}
        role="dialog"
      >
        <div className={styles.confirmationIcon}>
          <AdminIcon name="trash" size={22} />
        </div>
        <div>
          <h2 id="bulk-delete-title">Xóa {count} nhà hàng?</h2>
          <p id="bulk-delete-description">
            Các nhà hàng sẽ bị ẩn khỏi hệ thống. Dữ liệu liên quan vẫn được giữ lại để có thể khôi phục.
          </p>
        </div>
        <div className={styles.confirmationReason}>
          <span>Lý do xóa</span>
          <strong>{reason}</strong>
        </div>
        <div className={styles.confirmationActions}>
          <button
            className={styles.secondaryButton}
            disabled={deleting}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Hủy
          </button>
          <button
            className={styles.dangerButton}
            disabled={deleting}
            onClick={onConfirm}
            type="button"
          >
            <AdminIcon name="trash" size={16} />
            {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </section>
    </div>
  );
}

function RestaurantDetailModal({ restaurantId, onClose, onUpdated }) {
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarCaption, setAvatarCaption] = useState('');
  const [captions, setCaptions] = useState({});
  const mutationKeys = useRef(new Map());
  const reasonFieldRef = useRef(null);

  const imageMutationKey = (operation, file, payload = []) => {
    const fingerprint = [
      operation,
      file.name,
      file.size,
      file.type,
      file.lastModified,
      ...payload,
    ].join(':');
    return {
      fingerprint,
      idempotencyKey: getOrCreateMutationKey(mutationKeys.current, fingerprint),
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
      setAvatarCaption(
        (result.images || []).find((image) => image.isPrimary)?.caption || '',
      );
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

  const images = restaurant?.images || [];
  const primaryImage = images.find((image) => image.isPrimary) || null;
  const galleryImages = images.filter((image) => !image.isPrimary);

  const refreshAfterMutation = async () => {
    await loadDetail();
    await onUpdated();
  };

  const save = async (event) => {
    event.preventDefault();
    if (!changed) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10) {
      setSaveAttempted(true);
      reasonFieldRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    setSaveSuccess('');
    try {
      const body = { reason: normalizedReason };
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
      setSaveAttempted(false);
      await refreshAfterMutation();
      setSaveSuccess('Thông tin nhà hàng đã được cập nhật.');
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
      body.set('isPrimary', 'false');
      const mutation = imageMutationKey('upload', uploadFile, [
        uploadCaption.trim(),
        'false',
      ]);
      await adminService.uploadRestaurantImage(restaurantId, body, mutation.idempotencyKey);
      mutationKeys.current.delete(mutation.fingerprint);
      setUploadFile(null);
      setUploadCaption('');
      formElement.reset();
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const uploadAvatar = async (event) => {
    event.preventDefault();
    if (!avatarFile || primaryImage) return;
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('restaurantImage', avatarFile);
      body.set('caption', avatarCaption);
      body.set('isPrimary', 'true');
      const mutation = imageMutationKey('avatar', avatarFile, [avatarCaption.trim()]);
      await adminService.uploadRestaurantImage(restaurantId, body, mutation.idempotencyKey);
      mutationKeys.current.delete(mutation.fingerprint);
      setAvatarFile(null);
      setAvatarCaption('');
      formElement.reset();
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const replaceImage = async (image, file, caption = captions[image.id] || '') => {
    if (!file) return;
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('restaurantImage', file);
      body.set('caption', caption);
      const mutation = imageMutationKey(`replace:${image.id}`, file, [
        caption.trim(),
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
    setSaveSuccess('');
    setForm({
      ...form,
      categoryIds: exists
        ? form.categoryIds.filter((id) => id !== categoryId)
        : [...form.categoryIds, categoryId],
    });
  };

  const updateForm = (updates) => {
    setSaveSuccess('');
    setForm((current) => ({ ...current, ...updates }));
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
          <div className={styles.restaurantModalHeaderTitle}>
            <h2 id="restaurant-detail-title">Chi tiết nhà hàng</h2>
            <p>{restaurant ? `${restaurant.name} · ${restaurant.id}` : 'Đang tải dữ liệu'}</p>
          </div>
          <div className={styles.restaurantModalHeaderActions}>
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
              disabled={!changed || submitting}
              form="restaurant-profile-form"
              type="submit"
            >
              {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
            <button
              aria-label="Đóng"
              className={styles.iconButton}
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              <AdminIcon name="close" size={18} />
            </button>
          </div>
        </header>

        <div className={styles.modalBody}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          {loading && <div className={styles.emptyInline}>Đang tải chi tiết nhà hàng...</div>}
          {!loading && restaurant && form && (
            <div className={styles.restaurantDetailLayout}>
              <form
                className={styles.restaurantProfileForm}
                id="restaurant-profile-form"
                onSubmit={save}
              >
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
                    onChange={(event) => updateForm({ name: event.target.value })}
                    required
                    value={form.name}
                  />
                  <label className={styles.formField}>
                    <span>Trạng thái</span>
                    <select
                      onChange={(event) => updateForm({ status: event.target.value })}
                      value={form.status}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Địa chỉ"
                    onChange={(event) => updateForm({ address: event.target.value })}
                    value={form.address}
                  />
                  <Field
                    label="Số điện thoại"
                    maxLength={30}
                    onChange={(event) => updateForm({ phoneNumber: event.target.value })}
                    value={form.phoneNumber}
                  />
                  <Field
                    label="Vĩ độ"
                    max="90"
                    min="-90"
                    onChange={(event) => updateForm({ latitude: event.target.value })}
                    step="any"
                    type="number"
                    value={form.latitude}
                  />
                  <Field
                    label="Kinh độ"
                    max="180"
                    min="-180"
                    onChange={(event) => updateForm({ longitude: event.target.value })}
                    step="any"
                    type="number"
                    value={form.longitude}
                  />
                </div>

                <label className={styles.formField}>
                  <span>Mô tả</span>
                  <textarea
                    maxLength={5000}
                    onChange={(event) => updateForm({ description: event.target.value })}
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
                    aria-describedby="restaurant-update-reason-help"
                    aria-invalid={saveAttempted && reason.trim().length < 10}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Mô tả lý do và căn cứ thay đổi"
                    ref={reasonFieldRef}
                    value={reason}
                  />
                  <span className={styles.formFieldHelp} id="restaurant-update-reason-help">
                    {saveAttempted && reason.trim().length < 10
                      ? `Cần nhập thêm ${10 - reason.trim().length} ký tự để lưu thay đổi.`
                      : `${reason.trim().length}/500 ký tự`}
                  </span>
                </label>

                {saveSuccess && (
                  <div aria-live="polite" className={styles.successBanner} role="status">
                    <AdminIcon name="check" size={16} />
                    {saveSuccess}
                  </div>
                )}

              </form>

              <div className={styles.restaurantMediaColumn}>
                <section className={styles.restaurantAvatarSection}>
                  <div className={styles.restaurantModalSectionHeader}>
                    <div>
                      <h3>Ảnh đại diện</h3>
                      <p>Ảnh nhận diện chính, hiển thị tại danh sách và trang nhà hàng.</p>
                    </div>
                  </div>

                  {primaryImage ? (
                    <article className={styles.restaurantAvatarCard}>
                      <a href={primaryImage.imageUrl} rel="noreferrer" target="_blank">
                        <Image
                          alt={primaryImage.caption || `Ảnh đại diện ${restaurant.name}`}
                          height={360}
                          src={primaryImage.imageUrl}
                          unoptimized
                          width={640}
                        />
                      </a>
                      <div className={styles.restaurantAvatarCardBody}>
                        <div className={styles.restaurantImageMeta}>
                          <Badge tone="success">Đang sử dụng</Badge>
                          <span>{new Date(primaryImage.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <label className={styles.restaurantCaptionField}>
                          <span>Chú thích ảnh đại diện</span>
                          <input
                            maxLength={255}
                            onChange={(event) => setAvatarCaption(event.target.value)}
                            value={avatarCaption}
                          />
                        </label>
                        <div className={styles.restaurantImageActions}>
                          <button
                            className={styles.secondaryButton}
                            disabled={submitting || avatarCaption === (primaryImage.caption || '')}
                            onClick={() => updateImage(primaryImage, { caption: avatarCaption })}
                            type="button"
                          >
                            Lưu chú thích
                          </button>
                          <label className={styles.secondaryButton}>
                            Thay ảnh đại diện
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              disabled={submitting}
                              hidden
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                replaceImage(primaryImage, file, avatarCaption);
                              }}
                              type="file"
                            />
                          </label>
                          <button
                            className={styles.dangerButton}
                            disabled={submitting}
                            onClick={() => removeImage(primaryImage)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </article>
                  ) : (
                    <form className={styles.restaurantAvatarUpload} onSubmit={uploadAvatar}>
                      <div className={styles.restaurantAvatarPlaceholder}>
                        <AdminIcon name="image" size={24} />
                        <strong>Chưa có ảnh đại diện</strong>
                        <span>Chọn một ảnh vuông hoặc ngang, tối đa 5 MB.</span>
                      </div>
                      <div className={styles.restaurantAvatarUploadFields}>
                        <FileField
                          accept="image/jpeg,image/png,image/webp"
                          fileName={avatarFile?.name}
                          label="Chọn ảnh đại diện"
                          onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                          required
                        />
                        <Field
                          label="Chú thích"
                          maxLength={255}
                          onChange={(event) => setAvatarCaption(event.target.value)}
                          value={avatarCaption}
                        />
                        <button
                          className={styles.primaryButton}
                          disabled={!avatarFile || submitting}
                          type="submit"
                        >
                          <AdminIcon name="upload" size={16} />
                          Tải ảnh đại diện
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                <section className={styles.restaurantGallerySection}>
                  <div className={styles.restaurantModalSectionHeader}>
                    <div>
                      <h3>Ảnh chi tiết nhà hàng</h3>
                      <p>{galleryImages.length} ảnh trong thư viện · JPG, PNG hoặc WebP · tối đa 5 MB</p>
                    </div>
                  </div>

                  <form className={styles.restaurantImageUpload} onSubmit={uploadImage}>
                    <FileField
                      accept="image/jpeg,image/png,image/webp"
                      fileName={uploadFile?.name}
                      label="Chọn ảnh chi tiết"
                      onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                      required
                    />
                    <Field
                      label="Chú thích"
                      maxLength={255}
                      onChange={(event) => setUploadCaption(event.target.value)}
                      value={uploadCaption}
                    />
                    <button className={styles.primaryButton} disabled={!uploadFile || submitting} type="submit">
                      <AdminIcon name="upload" size={16} />
                      Thêm vào thư viện
                    </button>
                  </form>

                  <div className={styles.restaurantGalleryGrid}>
                    {galleryImages.map((image) => (
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
                            <span>Ảnh chi tiết</span>
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
                            <button
                              className={styles.secondaryButton}
                              disabled={submitting}
                              onClick={() => updateImage(image, { isPrimary: true })}
                              type="button"
                            >
                              Dùng làm ảnh đại diện
                            </button>
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
                    {galleryImages.length === 0 && (
                      <div className={styles.restaurantGalleryEmpty}>
                        <AdminIcon name="image" size={24} />
                        <strong>Chưa có ảnh chi tiết</strong>
                        <p>Ảnh đại diện được quản lý riêng ở phía trên.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminRestaurantsSection() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState(() => new Set());
  const [restaurants, setRestaurants] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteAttempted, setDeleteAttempted] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestSequence = useRef(0);
  const bulkDeleteKeys = useRef(new Map());
  const deleteReasonRef = useRef(null);
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

  const pageRestaurantIds = restaurants.map((restaurant) => restaurant.id);
  const selectedOnPage = pageRestaurantIds.filter((id) => selectedRestaurantIds.has(id));
  const allOnPageSelected = pageRestaurantIds.length > 0
    && selectedOnPage.length === pageRestaurantIds.length;
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected;

  const toggleRestaurantSelection = (restaurantId) => {
    setError('');
    setDeleteSuccess('');
    const next = new Set(selectedRestaurantIds);
    if (next.has(restaurantId)) {
      next.delete(restaurantId);
    } else if (next.size >= MAX_BULK_DELETE_RESTAURANTS) {
      setError(`Chỉ có thể xóa tối đa ${MAX_BULK_DELETE_RESTAURANTS} nhà hàng mỗi lần.`);
      return;
    } else {
      next.add(restaurantId);
    }
    setSelectedRestaurantIds(next);
  };

  const togglePageSelection = () => {
    setError('');
    setDeleteSuccess('');
    const next = new Set(selectedRestaurantIds);
    if (allOnPageSelected) {
      pageRestaurantIds.forEach((id) => next.delete(id));
    } else {
      const availableSlots = MAX_BULK_DELETE_RESTAURANTS - next.size;
      const missingIds = pageRestaurantIds.filter((id) => !next.has(id));
      missingIds.slice(0, availableSlots).forEach((id) => next.add(id));
      if (missingIds.length > availableSlots) {
        setError(`Chỉ có thể xóa tối đa ${MAX_BULK_DELETE_RESTAURANTS} nhà hàng mỗi lần.`);
      }
    }
    setSelectedRestaurantIds(next);
  };

  const openDeleteConfirmation = () => {
    const restaurantIds = [...selectedRestaurantIds].sort();
    if (restaurantIds.length === 0) return;
    const normalizedReason = deleteReason.trim();
    if (normalizedReason.length < 10) {
      setDeleteAttempted(true);
      deleteReasonRef.current?.focus();
      return;
    }
    setDeleteConfirmationOpen(true);
  };

  const deleteSelectedRestaurants = async () => {
    const restaurantIds = [...selectedRestaurantIds].sort();
    const normalizedReason = deleteReason.trim();
    const fingerprint = `${restaurantIds.join('|')}:${normalizedReason}`;
    if (!bulkDeleteKeys.current.has(fingerprint)) {
      bulkDeleteKeys.current.clear();
    }
    const idempotencyKey = getOrCreateMutationKey(bulkDeleteKeys.current, fingerprint);
    setDeleting(true);
    setError('');
    setDeleteSuccess('');
    try {
      const result = await adminService.deleteRestaurants(
        { restaurantIds, reason: normalizedReason },
        idempotencyKey,
      );
      bulkDeleteKeys.current.delete(fingerprint);
      setSelectedRestaurantIds(new Set());
      setDeleteReason('');
      setDeleteAttempted(false);
      setDeleteConfirmationOpen(false);
      if (selectedRestaurantId && restaurantIds.includes(selectedRestaurantId)) {
        setSelectedRestaurantId(null);
      }
      setDeleteSuccess(`Đã xóa mềm ${result.deletedCount} nhà hàng.`);
      const remainingTotal = Math.max(0, total - result.deletedCount);
      const remainingPageCount = Math.max(1, Math.ceil(remainingTotal / pageSize));
      if (page > remainingPageCount) {
        setPage(remainingPageCount);
      } else {
        await reload();
      }
    } catch (requestError) {
      if (
        requestError.status >= 400
        && requestError.status < 500
        && requestError.code !== 'REQUEST_IN_PROGRESS'
      ) {
        bulkDeleteKeys.current.delete(fingerprint);
      }
      setDeleteConfirmationOpen(false);
      setError(requestError.message);
    } finally {
      setDeleting(false);
    }
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
                setDeleteSuccess('');
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
            <button
              aria-label="Tải lại dữ liệu"
              className={styles.iconButton}
              disabled={deleting}
              onClick={reload}
              type="button"
            >
              <AdminIcon name="refresh" size={18} />
            </button>
          </div>
        </div>

        <div className={styles.boundaryNotice}>
          <AdminIcon name="lock" size={18} />
          <span>ADMIN và SUPER_ADMIN có thể chỉnh sửa hồ sơ, trạng thái, thư viện ảnh và xóa mềm nhà hàng.</span>
        </div>

        {selectedRestaurantIds.size > 0 && (
          <div className={styles.restaurantBulkActions}>
            <div className={styles.restaurantBulkSummary}>
              <strong>{selectedRestaurantIds.size} nhà hàng đã chọn</strong>
              <span>Lựa chọn được giữ khi chuyển trang hoặc tìm kiếm, tối đa 100 nhà hàng.</span>
            </div>
            <label className={styles.restaurantBulkReason}>
              <span>Lý do xóa</span>
              <input
                aria-invalid={deleteAttempted && deleteReason.trim().length < 10}
                maxLength={500}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Nhập lý do tối thiểu 10 ký tự"
                ref={deleteReasonRef}
                value={deleteReason}
              />
              {deleteAttempted && deleteReason.trim().length < 10 && (
                <small>Cần nhập thêm {10 - deleteReason.trim().length} ký tự.</small>
              )}
            </label>
            <div className={styles.restaurantBulkButtons}>
              <button
                className={styles.secondaryButton}
                disabled={deleting}
                onClick={() => {
                  setSelectedRestaurantIds(new Set());
                  setDeleteReason('');
                  setDeleteAttempted(false);
                }}
                type="button"
              >
                Bỏ chọn
              </button>
              <button
                className={styles.dangerButton}
                disabled={deleting}
                onClick={openDeleteConfirmation}
                type="button"
              >
                <AdminIcon name="trash" size={16} />
                {deleting ? 'Đang xóa...' : `Xóa ${selectedRestaurantIds.size} nhà hàng`}
              </button>
            </div>
          </div>
        )}

        {deleteSuccess && (
          <div aria-live="polite" className={styles.restaurantBulkSuccess} role="status">
            <AdminIcon name="check" size={16} />
            {deleteSuccess}
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th className={styles.selectionCell}>
                  <SelectionCheckbox
                    aria-label="Chọn tất cả nhà hàng trên trang này"
                    checked={allOnPageSelected}
                    disabled={loading || deleting || restaurants.length === 0}
                    indeterminate={someOnPageSelected}
                    onChange={togglePageSelection}
                  />
                </th>
                <th>Nhà hàng</th>
                <th>Địa điểm</th>
                <th>Điểm tin cậy</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6"><div className={styles.emptyInline}>Đang tải dữ liệu...</div></td></tr>
              )}
              {!loading && restaurants.map((restaurant) => (
                <tr
                  className={selectedRestaurantIds.has(restaurant.id) ? styles.selectedTableRow : undefined}
                  key={restaurant.id}
                >
                  <td className={styles.selectionCell}>
                    <SelectionCheckbox
                      aria-label={`Chọn ${restaurant.name}`}
                      checked={selectedRestaurantIds.has(restaurant.id)}
                      disabled={deleting}
                      onChange={() => toggleRestaurantSelection(restaurant.id)}
                    />
                  </td>
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
                <tr><td colSpan="6"><div className={styles.emptyInline}>Không tìm thấy nhà hàng phù hợp.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>Trang {page} / {pageCount}</span>
          <div>
            <button
              className={styles.secondaryButton}
              disabled={loading || deleting || page <= 1}
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
              disabled={loading || deleting || page >= pageCount}
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

      {deleteConfirmationOpen && (
        <BulkDeleteConfirmationModal
          count={selectedRestaurantIds.size}
          deleting={deleting}
          onCancel={() => setDeleteConfirmationOpen(false)}
          onConfirm={deleteSelectedRestaurants}
          reason={deleteReason.trim()}
        />
      )}
    </>
  );
}
