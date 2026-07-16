'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminService } from '@/services/admin.service';
import styles from './AdminClaimsSection.module.css';

const statusLabels = {
  SUBMITTED: 'Mới gửi',
  UNDER_REVIEW: 'Đang xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

export default function AdminClaimsSection() {
  const [status, setStatus] = useState('SUBMITTED');
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyClaimId, setBusyClaimId] = useState('');
  const [error, setError] = useState('');

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminService.listRestaurantClaims(status);
      setClaims(result?.items ?? []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải hàng đợi xác minh.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    let active = true;
    adminService.listRestaurantClaims(status)
      .then((result) => {
        if (active) setClaims(result?.items ?? []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Không thể tải hàng đợi xác minh.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  const decide = async (claim, decision) => {
    const note = window.prompt(
      decision === 'APPROVED'
        ? 'Ghi chú quyết định (không bắt buộc)'
        : 'Lý do từ chối (bắt buộc)',
      '',
    );
    if (note === null || (decision === 'REJECTED' && !note.trim())) return;

    setBusyClaimId(claim.id);
    setError('');
    try {
      await adminService.decideRestaurantClaim(claim.id, decision, note.trim());
      await loadClaims();
    } catch (decisionError) {
      setError(decisionError.message || 'Không thể lưu quyết định.');
    } finally {
      setBusyClaimId('');
    }
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>Xác minh quyền quản lý</span>
          <h2>Bằng chứng nhà hàng</h2>
          <p>Giấy phép kinh doanh và tài liệu sở hữu được lưu riêng tư, tách khỏi hóa đơn đánh giá của khách hàng.</p>
        </div>
        <div className={styles.filters}>
          <select
            aria-label="Lọc trạng thái"
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
            }}
            value={status}
          >
            <option value="SUBMITTED">Mới gửi</option>
            <option value="UNDER_REVIEW">Đang xem xét</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Đã từ chối</option>
          </select>
          <button onClick={loadClaims} type="button">Tải lại</button>
        </div>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <p className={styles.empty}>Đang tải hàng đợi...</p>}
      {!loading && claims.length === 0 && <p className={styles.empty}>Không có hồ sơ ở trạng thái này.</p>}

      <div className={styles.list}>
        {claims.map((claim) => (
          <article className={styles.claim} key={claim.id}>
            <div className={styles.claimMain}>
              <div className={styles.claimTitle}>
                <strong>{claim.restaurantName || claim.restaurantId}</strong>
                <span>{statusLabels[claim.status] || claim.status}</span>
              </div>
              <p>{claim.businessName || claim.merchantName || 'Hồ sơ merchant'}</p>
              <dl>
                <div><dt>Quyền yêu cầu</dt><dd>{claim.requestedPermissionLevel}</dd></div>
                <div><dt>Ngày gửi</dt><dd>{new Date(claim.createdAt).toLocaleDateString('vi-VN')}</dd></div>
              </dl>
            </div>
            <div className={styles.actions}>
              {claim.evidenceUrl
                ? <a href={claim.evidenceUrl} rel="noreferrer" target="_blank">Mở bằng chứng</a>
                : <span>URL bằng chứng không khả dụng</span>}
              {['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status) && (
                <>
                  <button
                    className={styles.approve}
                    disabled={busyClaimId === claim.id}
                    onClick={() => decide(claim, 'APPROVED')}
                    type="button"
                  >
                    Duyệt
                  </button>
                  <button
                    className={styles.reject}
                    disabled={busyClaimId === claim.id}
                    onClick={() => decide(claim, 'REJECTED')}
                    type="button"
                  >
                    Từ chối
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
