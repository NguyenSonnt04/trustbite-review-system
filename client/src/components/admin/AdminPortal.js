'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminCapabilities, adminService } from '@/services/admin.service';
import { authService } from '@/services/auth.service';
import RestaurantMediaManager from '@/components/restaurant-media/RestaurantMediaManager';
import AdminIcon from './AdminIcon';
import AdminClaimsSection from './AdminClaimsSection';
import styles from './AdminPortal.module.css';

const navigationGroups = [
  {
    label: 'Chính',
    items: [{ id: 'overview', label: 'Tổng quan', icon: 'dashboard' }],
  },
  {
    label: 'Quản lý',
    items: [
      { id: 'restaurants', label: 'Nhà hàng', icon: 'store' },
      { id: 'users', label: 'Người dùng', icon: 'users' },
    ],
  },
  {
    label: 'Tin cậy',
    items: [
      { id: 'reviews', label: 'Đánh giá', icon: 'reviews' },
      { id: 'verifications', label: 'Xác minh', icon: 'receipt' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { id: 'audit', label: 'Nhật ký', icon: 'audit' },
      { id: 'monitoring', label: 'Giám sát', icon: 'monitor' },
    ],
  },
];

const sectionCopy = {
  overview: ['Trung tâm điều hành', 'Theo dõi sức khỏe hệ thống và các khu vực quản trị quan trọng.'],
  users: ['Quản lý người dùng', 'Kiểm soát trạng thái tài khoản và quyền truy cập một cách an toàn.'],
  restaurants: ['Quản lý nhà hàng', 'Theo dõi dữ liệu nhà hàng đang được hiển thị trên TrustBite.'],
  reviews: ['Kiểm duyệt đánh giá', 'Xử lý nội dung được báo cáo và các quyết định kiểm duyệt.'],
  verifications: ['Hàng đợi xác minh', 'Theo dõi receipt, OCR và các trường hợp cần quản trị viên quyết định.'],
  audit: ['Nhật ký quản trị', 'Theo dõi hành động nhạy cảm và lịch sử thay đổi hệ thống.'],
  monitoring: ['Giám sát hệ thống', 'Kiểm tra trạng thái API và mức độ sẵn sàng của từng dịch vụ.'],
};

const capabilityLabel = {
  blocked: 'Chờ API',
  'read-only': 'Chỉ đọc',
  partial: 'Một phần',
};

const capabilityModules = [
  { id: 'users', label: 'Người dùng', icon: 'users' },
  { id: 'restaurants', label: 'Nhà hàng', icon: 'store' },
  { id: 'reviews', label: 'Đánh giá', icon: 'reviews' },
  { id: 'verifications', label: 'Xác minh', icon: 'receipt' },
  { id: 'audit', label: 'Nhật ký', icon: 'audit' },
  { id: 'monitoring', label: 'Giám sát', icon: 'monitor' },
];

const formatScore = (score) => {
  if (score === null || score === undefined || score === '') return null;
  const number = Number(score);
  return Number.isFinite(number) ? number.toFixed(1) : null;
};

const formatRestaurantStatus = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'active') return { label: 'Hoạt động', tone: 'success' };
  if (normalized === 'inactive') return { label: 'Tạm ngưng', tone: 'neutral' };
  return { label: status || 'Chưa rõ', tone: 'neutral' };
};

function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function LockedState({ capability, title }) {
  return (
    <section className={styles.lockedState}>
      <div className={styles.lockedIcon}><AdminIcon name="lock" size={24} /></div>
      <StatusBadge tone="warning">{capabilityLabel[capability.state]}</StatusBadge>
      <h2>{title}</h2>
      <p>{capability.detail}</p>
      <button className={styles.secondaryButton} disabled type="button">
        Chưa thể thao tác
      </button>
    </section>
  );
}

function Overview({ apiState, restaurants, restaurantTotal, onNavigate }) {
  const connectedCount = capabilityModules.filter(({ id }) => adminCapabilities[id].state !== 'blocked').length;
  const blockedCount = capabilityModules.length - connectedCount;
  const apiStatus = apiState === 'online'
    ? { value: 'Trực tuyến', trend: 'Hoạt động bình thường', tone: 'positive' }
    : apiState === 'loading'
      ? { value: 'Đang kiểm tra', trend: 'Đang chờ phản hồi', tone: 'neutral' }
      : { value: 'Ngoại tuyến', trend: 'Cần kiểm tra', tone: 'negative' };

  const metrics = [
    {
      label: 'Nhà hàng hoạt động',
      value: apiState === 'online' ? restaurantTotal : '—',
      context: 'Dữ liệu công khai',
      trend: apiState === 'online' ? 'Đã đồng bộ' : 'Chưa kết nối',
      trendTone: apiState === 'online' ? 'positive' : 'negative',
      icon: 'store',
    },
    {
      label: 'API server',
      value: apiStatus.value,
      context: 'Trạng thái tiến trình',
      trend: apiStatus.trend,
      trendTone: apiStatus.tone,
      icon: 'monitor',
    },
    {
      label: 'Mô-đun kết nối',
      value: `${connectedCount} / ${capabilityModules.length}`,
      context: 'Phạm vi API quản trị',
      trend: 'Nhà hàng, giám sát',
      trendTone: 'neutral',
      icon: 'dashboard',
    },
    {
      label: 'Mô-đun bị khóa',
      value: String(blockedCount),
      context: 'Chờ server API',
      trend: 'Không sử dụng dữ liệu giả',
      trendTone: 'neutral',
      icon: 'lock',
    },
  ];

  return (
    <>
      <section className={styles.metricGrid} aria-label="Chỉ số hệ thống">
        {metrics.map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <div className={styles.metricLabel}>
              <AdminIcon name={metric.icon} size={15} />
              <span>{metric.label}</span>
            </div>
            <p>{metric.context}</p>
            <strong>{metric.value}</strong>
            <div className={`${styles.metricTrend} ${styles[`metricTrend_${metric.trendTone}`]}`}>
              <AdminIcon
                name={metric.trendTone === 'positive' ? 'trendUp' : metric.trendTone === 'negative' ? 'trendDown' : 'neutral'}
                size={14}
              />
              {metric.trend}
            </div>
          </article>
        ))}
      </section>

      <section className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.chartHeader}>
          <div>
            <strong>{connectedCount} / {capabilityModules.length} mô-đun</strong>
            <span>Khả năng API quản trị hiện có</span>
          </div>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilityModules.map((module) => {
            const capability = adminCapabilities[module.id];
            return (
              <div className={styles.capabilityItem} key={module.id}>
                <span className={styles.capabilityIcon}><AdminIcon name={module.icon} size={18} /></span>
                <div>
                  <strong>{module.label}</strong>
                  <small>{capability.detail}</small>
                </div>
                <StatusBadge tone={capability.state === 'blocked' ? 'warning' : 'neutral'}>
                  {capabilityLabel[capability.state]}
                </StatusBadge>
              </div>
            );
          })}
        </div>
      </section>

      <div className={styles.overviewGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Nhà hàng gần đây</h2><span>Dữ liệu đang hiển thị trên TrustBite</span></div>
            <button className={styles.textButton} onClick={() => onNavigate('restaurants')} type="button">Xem tất cả</button>
          </div>
          <div className={styles.compactList}>
            {restaurants.slice(0, 4).map((restaurant) => (
              <div className={styles.compactRow} key={restaurant.id}>
                <span className={styles.entityAvatar}>{restaurant.name?.slice(0, 1).toUpperCase()}</span>
                <div className={styles.compactMain}>
                  <strong>{restaurant.name}</strong>
                  <span>{restaurant.address || 'Địa chỉ chưa cập nhật'}</span>
                </div>
                <StatusBadge tone={formatRestaurantStatus(restaurant.status).tone}>
                  {formatRestaurantStatus(restaurant.status).label}
                </StatusBadge>
                <strong className={styles.tableScore}>{formatScore(restaurant.trustScore) ?? '—'}</strong>
              </div>
            ))}
            {restaurants.length === 0 && <div className={styles.emptyInline}>Chưa tải được dữ liệu nhà hàng.</div>}
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Trạng thái hệ thống</h2><span>Thông tin server công khai</span></div>
            <span className={`${styles.liveDot} ${apiState === 'online' ? styles.liveDotOnline : ''}`} />
          </div>
          <div className={styles.pulseList}>
            <div>
              <span>Express API</span>
              <StatusBadge tone={apiState === 'online' ? 'success' : apiState === 'loading' ? 'neutral' : 'danger'}>
                {apiStatus.value}
              </StatusBadge>
            </div>
            <div><span>PostgreSQL</span><StatusBadge>Chưa có điểm kiểm tra</StatusBadge></div>
            <div><span>Worker OCR</span><StatusBadge>Chưa có điểm kiểm tra</StatusBadge></div>
            <div><span>Nhà cung cấp AWS</span><StatusBadge>Chưa có điểm kiểm tra</StatusBadge></div>
          </div>
          <p className={styles.securityNote}>
            Chỉ hiển thị trạng thái được server công khai. Không suy đoán trạng thái hạ tầng từ phía trình duyệt.
          </p>
        </aside>
      </div>
    </>
  );
}

function RestaurantSection({
  canManage,
  loading,
  error,
  restaurants,
  total,
  search,
  selectedRestaurant,
  onSearch,
  onReload,
  onSelectRestaurant,
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return restaurants;
    return restaurants.filter((restaurant) => (
      restaurant.name?.toLocaleLowerCase('vi').includes(query)
      || restaurant.address?.toLocaleLowerCase('vi').includes(query)
    ));
  }, [restaurants, search]);

  return (
    <section className={styles.panel}>
      <div className={styles.tableToolbar}>
        <div className={styles.searchBox}>
          <AdminIcon name="search" size={18} />
          <input
            aria-label="Tìm nhà hàng"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc địa chỉ"
            type="search"
            value={search}
          />
        </div>
        <div className={styles.toolbarActions}>
          <StatusBadge tone="neutral">{total} nhà hàng</StatusBadge>
          <button aria-label="Tải lại dữ liệu" className={styles.iconButton} onClick={onReload} type="button">
            <AdminIcon name="refresh" size={18} />
          </button>
          <button className={styles.primaryButton} disabled title={adminCapabilities.restaurants.detail} type="button">
            Thêm nhà hàng
          </button>
        </div>
      </div>

      {!canManage && (
        <div className={styles.boundaryNotice}>
          <AdminIcon name="lock" size={18} />
          <span>Bản xem chỉ đọc không gửi yêu cầu quản trị.</span>
        </div>
      )}

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
            {!loading && filtered.map((restaurant) => (
              <tr key={restaurant.id}>
                <td>
                  <div className={styles.entityCell}>
                    <span className={styles.entityAvatar}>{restaurant.name?.slice(0, 1).toUpperCase()}</span>
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
                  <StatusBadge tone={formatRestaurantStatus(restaurant.status).tone}>
                    {formatRestaurantStatus(restaurant.status).label}
                  </StatusBadge>
                </td>
                <td>
                  <button
                    className={styles.smallButton}
                    disabled={!canManage}
                    onClick={() => onSelectRestaurant(restaurant)}
                    title={canManage ? 'Quản lý thư viện ảnh' : 'Cần phiên ADMIN hoặc SUPER_ADMIN'}
                    type="button"
                  >
                    Quản lý ảnh
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="5"><div className={styles.emptyInline}>Không tìm thấy nhà hàng phù hợp.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      {canManage && selectedRestaurant && (
        <RestaurantMediaManager
          onClose={() => onSelectRestaurant(null)}
          restaurant={selectedRestaurant}
        />
      )}
    </section>
  );
}

function MonitoringSection({ apiState, onReload }) {
  const expressState = apiState === 'online' ? 'Trực tuyến' : apiState === 'loading' ? 'Đang kiểm tra' : 'Ngoại tuyến';
  const expressTone = apiState === 'online' ? 'success' : apiState === 'loading' ? 'neutral' : 'danger';
  const services = [
    { name: 'Express API', description: 'Điểm kiểm tra tiến trình công khai', state: expressState, tone: expressTone },
    { name: 'PostgreSQL', description: 'Mức sẵn sàng và độ trễ cơ sở dữ liệu', state: 'Chờ API', tone: 'neutral' },
    { name: 'Redis / BullMQ', description: 'Độ sâu hàng đợi và trạng thái worker', state: 'Chờ API', tone: 'neutral' },
    { name: 'Nhà cung cấp AWS', description: 'S3, Textract, Cognito, SES', state: 'Chờ API', tone: 'neutral' },
  ];

  return (
    <div className={styles.monitorGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><span className={styles.eyebrow}>Trạng thái trực tiếp</span><h2>Dịch vụ hệ thống</h2></div>
          <button className={styles.secondaryButton} onClick={onReload} type="button">
            <AdminIcon name="refresh" size={16} /> Kiểm tra lại
          </button>
        </div>
        <div className={styles.serviceList}>
          {services.map((service) => (
            <div className={styles.serviceRow} key={service.name}>
              <span className={`${styles.serviceMark} ${styles[`serviceMark_${service.tone}`]}`} />
              <div><strong>{service.name}</strong><span>{service.description}</span></div>
              <StatusBadge tone={service.tone}>{service.state}</StatusBadge>
            </div>
          ))}
        </div>
      </section>
      <aside className={styles.monitorAside}>
        <div className={styles.darkCard}>
          <span className={styles.eyebrow}>Ranh giới bảo mật</span>
          <h2>Server luôn là nguồn sự thật.</h2>
          <p>Client không tự cấp quyền, không lưu secret và không mô phỏng dữ liệu vận hành nhạy cảm.</p>
          <div className={styles.securityChecklist}>
            <span>Bearer token cho protected API</span>
            <span>RBAC được server thực thi</span>
            <span>Không lộ provider credentials</span>
          </div>
        </div>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>Mức độ bao phủ</span>
          <h2>API giám sát</h2>
          <div className={styles.coverageBar}><span /></div>
          <strong className={styles.coverageValue}>1 / 4 điểm kiểm tra</strong>
          <p className={styles.mutedText}>{adminCapabilities.monitoring.detail}</p>
        </div>
      </aside>
    </div>
  );
}

export default function AdminPortal({ preview = false }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiState, setApiState] = useState('loading');
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [restaurantError, setRestaurantError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(preview ? 'preview' : 'loading');
  const [currentUser, setCurrentUser] = useState(null);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    setApiState('loading');
    setLoadingRestaurants(true);
    setRestaurantError('');

    const [healthResult, restaurantResult] = await Promise.allSettled([
      adminService.readHealth(),
      preview
        ? adminService.listRestaurants({ pageSize: 20 })
        : adminService.listAdminRestaurants({ pageSize: 50 }),
    ]);

    setApiState(
      healthResult.status === 'fulfilled' && healthResult.value?.status === 'ok'
        ? 'online'
        : 'offline',
    );

    if (restaurantResult.status === 'fulfilled') {
      setRestaurants(restaurantResult.value?.items ?? []);
      setRestaurantTotal(restaurantResult.value?.total ?? 0);
    } else {
      setRestaurants([]);
      setRestaurantTotal(0);
      setRestaurantError('Không thể tải danh sách nhà hàng từ server.');
    }
    setLoadingRestaurants(false);
  }, [preview]);

  useEffect(() => {
    if (!preview) return undefined;
    let active = true;

    Promise.allSettled([
      adminService.readHealth(),
      adminService.listRestaurants({ pageSize: 20 }),
    ]).then(([healthResult, restaurantResult]) => {
      if (!active) return;

      setApiState(
        healthResult.status === 'fulfilled' && healthResult.value?.status === 'ok'
          ? 'online'
          : 'offline',
      );

      if (restaurantResult.status === 'fulfilled') {
        setRestaurants(restaurantResult.value?.items ?? []);
        setRestaurantTotal(restaurantResult.value?.total ?? 0);
      } else {
        setRestaurantError('Không thể tải danh sách nhà hàng từ server.');
      }
      setLoadingRestaurants(false);
    });

    return () => {
      active = false;
    };
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    let active = true;
    adminService.getCurrentUser()
      .then((user) => {
        if (!active) return;
        const roles = (user?.roles ?? []).map((role) => String(role).toUpperCase());
        if (!roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN')) {
          setSessionStatus('forbidden');
          return;
        }
        setCurrentUser(user);
        setSessionStatus('ready');
        loadDashboard();
      })
      .catch(() => {
        if (active) setSessionStatus('signed-out');
      });
    return () => {
      active = false;
    };
  }, [loadDashboard, preview]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const selectSection = (section) => {
    setActiveSection(section);
    setMenuOpen(false);
  };

  const [title, subtitle] = sectionCopy[activeSection];
  const canManage = sessionStatus === 'ready';

  if (!preview && sessionStatus !== 'ready') {
    const signedOut = sessionStatus === 'signed-out';
    const forbidden = sessionStatus === 'forbidden';
    return (
      <main className={styles.accessGate}>
        <span className={styles.brandMark}>T</span>
        <h1>
          {sessionStatus === 'loading'
            ? 'Đang xác minh phiên quản trị'
            : forbidden
              ? 'Tài khoản không có quyền quản trị'
              : 'Đăng nhập để mở cổng quản trị'}
        </h1>
        <p>
          {forbidden
            ? 'Server không trả về vai trò ADMIN hoặc SUPER_ADMIN cho tài khoản này.'
            : 'Cognito xác thực danh tính, sau đó server kiểm tra vai trò TrustBite trước khi mở thao tác.'}
        </p>
        {signedOut && (
          <button
            className={styles.primaryButton}
            onClick={() => authService.login('/admin').catch(() => setSessionStatus('signed-out'))}
            type="button"
          >
            Đăng nhập với Cognito
          </button>
        )}
      </main>
    );
  }

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`} id="admin-navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark}>T</span>
          <div><strong>TrustBite</strong><span>{preview ? 'Bản xem quản trị' : 'Cổng quản trị'}</span></div>
          <button
            aria-label="Đóng menu"
            className={styles.mobileClose}
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
            ref={closeButtonRef}
            type="button"
          >
            <AdminIcon name="close" />
          </button>
        </div>

        <nav className={styles.navigation} aria-label="Điều hướng quản trị">
          {navigationGroups.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <span className={styles.navLabel}>{group.label}</span>
              {group.items.map((item) => (
                <button
                  className={`${styles.navItem} ${activeSection === item.id ? styles.navItemActive : ''}`}
                  aria-current={activeSection === item.id ? 'page' : undefined}
                  key={item.id}
                  onClick={() => selectSection(item.id)}
                  type="button"
                >
                  <AdminIcon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  {adminCapabilities[item.id]?.state === 'blocked' && <span className={styles.navLock}><AdminIcon name="lock" size={12} /></span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.accessCard}>
            <span className={styles.accessIcon}><AdminIcon name="lock" size={18} /></span>
            <div>
              <strong>{canManage ? 'Phiên đã xác minh' : 'Chế độ chỉ đọc'}</strong>
              <span>{canManage ? 'ADMIN / SUPER_ADMIN' : 'Không có quyền quản trị cục bộ'}</span>
            </div>
          </div>
          <p>Tin cậy trong từng trải nghiệm.</p>
        </div>
      </aside>

      {menuOpen && <button aria-label="Đóng menu" className={styles.backdrop} onClick={() => setMenuOpen(false)} type="button" />}

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button
            aria-controls="admin-navigation"
            aria-expanded={menuOpen}
            aria-label="Mở menu"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <AdminIcon name="menu" />
          </button>
          <div className={styles.pageTitle}>
            <span className={styles.mobileBrand}>Bản xem TrustBite</span>
            <h1>{title}</h1>
          </div>
          <div className={styles.topbarActions}>
            <div className={styles.apiPill} title={subtitle}>
              <span className={`${styles.liveDot} ${apiState === 'online' ? styles.liveDotOnline : ''}`} />
            </div>
            <div className={styles.profile}>
              <span>{currentUser?.displayName?.slice(0, 1).toUpperCase() || (preview ? 'X' : 'A')}</span>
              <div>
                <strong>{currentUser?.displayName || (preview ? 'Khách xem' : 'Quản trị viên')}</strong>
                <small>{canManage ? currentUser.roles.join(', ') : 'Không có phiên quản trị'}</small>
              </div>
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {activeSection === 'overview' && (
            <Overview
              apiState={apiState}
              onNavigate={selectSection}
              restaurantTotal={restaurantTotal}
              restaurants={restaurants}
            />
          )}
          {activeSection === 'restaurants' && (
            <RestaurantSection
              error={restaurantError}
              canManage={canManage}
              loading={loadingRestaurants}
              onReload={loadDashboard}
              onSearch={setSearch}
              onSelectRestaurant={setSelectedRestaurant}
              restaurants={restaurants}
              search={search}
              selectedRestaurant={selectedRestaurant}
              total={restaurantTotal}
            />
          )}
          {activeSection === 'monitoring' && <MonitoringSection apiState={apiState} onReload={loadDashboard} />}
          {activeSection === 'users' && <LockedState capability={adminCapabilities.users} title="Danh sách người dùng chưa khả dụng" />}
          {activeSection === 'reviews' && <LockedState capability={adminCapabilities.reviews} title="Khu vực kiểm duyệt chưa khả dụng" />}
          {activeSection === 'verifications' && (
            canManage
              ? <AdminClaimsSection />
              : <LockedState capability={adminCapabilities.verifications} title="Cần phiên quản trị để mở hàng đợi" />
          )}
          {activeSection === 'audit' && <LockedState capability={adminCapabilities.audit} title="Nhật ký audit chưa khả dụng" />}
        </div>
      </main>
    </div>
  );
}
