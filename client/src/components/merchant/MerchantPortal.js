'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { authService } from '@/services/auth.service';
import { createIdempotencyKey } from '@/services/idempotency';
import { merchantService } from '@/services/merchant.service';
import RestaurantMediaManager from '@/components/restaurant-media/RestaurantMediaManager';
import styles from './MerchantPortal.module.css';

const claimStatusLabel = {
  SUBMITTED: 'Đã gửi',
  UNDER_REVIEW: 'Đang xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

export default function MerchantPortal() {
  const [sessionStatus, setSessionStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [publicRestaurants, setPublicRestaurants] = useState([]);
  const [claims, setClaims] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [activeView, setActiveView] = useState('images');
  const [claimRestaurantId, setClaimRestaurantId] = useState('');
  const [permission, setPermission] = useState('MANAGER');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const claimAttemptRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [assignedResult, claimsResult, publicResult] = await Promise.allSettled([
      merchantService.listAssignedRestaurants(),
      merchantService.listClaims(),
      merchantService.listPublicRestaurants({ pageSize: 50 }),
    ]);
    if (assignedResult.status === 'fulfilled') {
      const items = assignedResult.value?.items ?? [];
      setRestaurants(items);
      setSelectedRestaurant((current) => current ?? items[0] ?? null);
    }
    if (claimsResult.status === 'fulfilled') {
      setClaims(claimsResult.value?.items ?? []);
    }
    if (publicResult.status === 'fulfilled') {
      setPublicRestaurants(publicResult.value?.items ?? []);
    }
    if (assignedResult.status === 'rejected' || claimsResult.status === 'rejected') {
      setError('Không thể tải đầy đủ dữ liệu merchant từ server.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/users/me', { cache: 'no-store' })
      .then((currentUser) => {
        if (!active) return;
        const roles = (currentUser?.roles ?? []).map((role) => String(role).toUpperCase());
        if (!roles.includes('MERCHANT')) {
          setSessionStatus('forbidden');
          return;
        }
        setUser(currentUser);
        setSessionStatus('ready');
        loadData();
      })
      .catch(() => {
        if (active) setSessionStatus('signed-out');
      });
    return () => {
      active = false;
    };
  }, [loadData]);

  const submitClaim = async (event) => {
    event.preventDefault();
    if (!claimRestaurantId || !evidenceFile) {
      setError('Vui lòng chọn nhà hàng và tài liệu bằng chứng.');
      return;
    }
    setSaving(true);
    setError('');
    const previousAttempt = claimAttemptRef.current;
    const idempotencyKey = previousAttempt
      && previousAttempt.restaurantId === claimRestaurantId
      && previousAttempt.permission === permission
      && previousAttempt.evidenceFile === evidenceFile
      ? previousAttempt.idempotencyKey
      : createIdempotencyKey();
    claimAttemptRef.current = {
      restaurantId: claimRestaurantId,
      permission,
      evidenceFile,
      idempotencyKey,
    };
    try {
      const createdClaim = await merchantService.submitClaim({
        restaurantId: claimRestaurantId,
        requestedPermissionLevel: permission,
        evidenceFile,
        idempotencyKey,
      });
      claimAttemptRef.current = null;
      setClaims((current) => [
        createdClaim,
        ...current.filter((claim) => claim.id !== createdClaim.id),
      ]);
      setClaimRestaurantId('');
      setEvidenceFile(null);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError.message || 'Không thể gửi hồ sơ xác minh.');
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus !== 'ready') {
    return (
      <main className={styles.accessGate}>
        <span className={styles.brandMark}>T</span>
        <h1>
          {sessionStatus === 'loading'
            ? 'Đang xác minh phiên merchant'
            : sessionStatus === 'forbidden'
              ? 'Tài khoản chưa có hồ sơ merchant'
              : 'Đăng nhập để quản lý nhà hàng'}
        </h1>
        <p>Danh tính do Cognito xác thực. Quyền OWNER hoặc MANAGER luôn được server kiểm tra theo từng nhà hàng.</p>
        {sessionStatus === 'signed-out' && (
          <button onClick={() => authService.login('/merchant')} type="button">
            Đăng nhập với Cognito
          </button>
        )}
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>T</span>
          <div><strong>TrustBite Merchant</strong><small>Không gian nhà hàng</small></div>
        </div>
        <div className={styles.profile}>
          <span>{user?.displayName?.slice(0, 1).toUpperCase() || 'M'}</span>
          <div><strong>{user?.displayName || 'Merchant'}</strong><small>Phiên đã xác minh</small></div>
          <button onClick={() => { authService.logout(); window.location.assign('/'); }} type="button">Đăng xuất</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span>Cổng vận hành nhà hàng</span>
            <h1>Hình ảnh và quyền quản lý.</h1>
            <p>Chỉ OWNER hoặc MANAGER đang hoạt động mới có thể thay đổi thư viện của nhà hàng được phân công.</p>
          </div>
          <div className={styles.metrics}>
            <article><strong>{restaurants.length}</strong><span>Nhà hàng được phân công</span></article>
            <article><strong>{claims.filter((claim) => ['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status)).length}</strong><span>Hồ sơ đang xử lý</span></article>
          </div>
        </section>

        <nav className={styles.tabs} aria-label="Khu vực merchant">
          <button className={activeView === 'images' ? styles.activeTab : ''} onClick={() => setActiveView('images')} type="button">
            Quản lý ảnh
          </button>
          <button className={activeView === 'claims' ? styles.activeTab : ''} onClick={() => setActiveView('claims')} type="button">
            Bằng chứng quyền quản lý
          </button>
        </nav>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {loading && <div className={styles.empty}>Đang tải dữ liệu merchant...</div>}

        {!loading && activeView === 'images' && (
          <>
            <section className={styles.restaurantPicker}>
              <div>
                <span>Nhà hàng được phân công</span>
                <h2>Chọn nhà hàng để quản lý thư viện</h2>
              </div>
              <select
                aria-label="Chọn nhà hàng"
                onChange={(event) => {
                  const restaurant = restaurants.find((item) => item.id === event.target.value);
                  setSelectedRestaurant(restaurant ?? null);
                }}
                value={selectedRestaurant?.id ?? ''}
              >
                {restaurants.length === 0 && <option value="">Chưa có nhà hàng được phân công</option>}
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name} · {restaurant.permissionLevel}
                  </option>
                ))}
              </select>
            </section>
            {selectedRestaurant
              ? <RestaurantMediaManager restaurant={selectedRestaurant} />
              : <div className={styles.empty}>Hồ sơ cần được quản trị viên duyệt trước khi bạn có thể quản lý ảnh.</div>}
          </>
        )}

        {!loading && activeView === 'claims' && (
          <div className={styles.claimGrid}>
            <form className={styles.claimForm} onSubmit={submitClaim}>
              <div>
                <span>Hồ sơ xác minh</span>
                <h2>Gửi giấy tờ chứng minh</h2>
                <p>Chấp nhận PDF, JPEG, PNG hoặc WebP tối đa 10 MB. Tài liệu được lưu riêng tư.</p>
              </div>
              <label>
                Nhà hàng
                <select onChange={(event) => setClaimRestaurantId(event.target.value)} required value={claimRestaurantId}>
                  <option value="">Chọn nhà hàng</option>
                  {publicRestaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>{restaurant.name} · {restaurant.address}</option>
                  ))}
                </select>
              </label>
              <label>
                Quyền đề nghị
                <select onChange={(event) => setPermission(event.target.value)} value={permission}>
                  <option value="OWNER">OWNER</option>
                  <option value="MANAGER">MANAGER</option>
                </select>
              </label>
              <label>
                Tài liệu bằng chứng
                <input
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
              </label>
              <button disabled={saving} type="submit">{saving ? 'Đang gửi...' : 'Gửi hồ sơ'}</button>
            </form>

            <section className={styles.claimList}>
              <div><span>Lịch sử</span><h2>Hồ sơ đã gửi</h2></div>
              {claims.map((claim) => (
                <article key={claim.id}>
                  <div>
                    <strong>{claim.restaurantName || claim.restaurantId}</strong>
                    <span>{claim.requestedPermissionLevel}</span>
                  </div>
                  <p>{claimStatusLabel[claim.status] || claim.status}</p>
                  {claim.adminNote && <small>{claim.adminNote}</small>}
                </article>
              ))}
              {claims.length === 0 && <p className={styles.empty}>Bạn chưa gửi hồ sơ xác minh.</p>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
