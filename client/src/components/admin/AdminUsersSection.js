'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '@/services/admin.service';
import AdminIcon from './AdminIcon';
import styles from './AdminPortal.module.css';

const PAGE_SIZE = 15;
const EMPTY_CREATE_FORM = {
  email: '',
  displayName: '',
  phoneNumber: '',
  dateOfBirth: '',
};

const formatStatus = (status) => {
  if (status === 'ACTIVE') return { label: 'Hoạt động', tone: 'success' };
  if (status === 'SUSPENDED') return { label: 'Tạm khóa', tone: 'warning' };
  if (status === 'DELETED') return { label: 'Đã xóa', tone: 'danger' };
  return { label: status || 'Chưa rõ', tone: 'neutral' };
};

const formatDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
};

const sameRoles = (left = [], right = []) => (
  [...left].sort().join('|') === [...right].sort().join('|')
);

function Badge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function Field({ label, error, ...inputProps }) {
  return (
    <label className={styles.formField}>
      <span>{label}</span>
      <input {...inputProps} aria-invalid={Boolean(error)} />
      {error && <small>{error}</small>}
    </label>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section
        aria-labelledby="admin-user-dialog-title"
        aria-modal="true"
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="admin-user-dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button aria-label="Đóng" className={styles.iconButton} onClick={onClose} type="button">
            <AdminIcon name="close" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_CREATE_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await adminService.createUser(form);
      onCreated();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      subtitle="Tài khoản được tạo trong Cognito và dùng luồng OTP hiện có."
      title="Thêm người dùng"
    >
      <form className={styles.modalBody} onSubmit={submit}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.formGrid}>
          <Field
            autoComplete="off"
            label="Họ và tên"
            maxLength={120}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            required
            value={form.displayName}
          />
          <Field
            autoComplete="off"
            label="Email đăng nhập"
            maxLength={254}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
            type="email"
            value={form.email}
          />
          <Field
            autoComplete="off"
            label="Số điện thoại"
            onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
            placeholder="0912345678"
            required
            value={form.phoneNumber}
          />
          <Field
            label="Ngày sinh"
            max="9999-12-31"
            min="1900-01-01"
            onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
            required
            type="date"
            value={form.dateOfBirth}
          />
        </div>
        <div className={styles.infoCallout}>
          <AdminIcon name="info" size={17} />
          <span>Người dùng mới nhận vai trò USER. Chỉ SUPER_ADMIN có thể cấp quyền quản trị sau đó.</span>
        </div>
        <footer className={styles.modalFooter}>
          <button className={styles.secondaryButton} disabled={submitting} onClick={onClose} type="button">
            Hủy
          </button>
          <button className={styles.primaryButton} disabled={submitting} type="submit">
            {submitting ? 'Đang tạo...' : 'Tạo người dùng'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function UserDetailModal({ adminRole, currentUserId, userId, onClose, onUpdated }) {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    adminService.getUser(userId)
      .then((result) => {
        if (!active) return;
        setUser(result);
        setForm({
          displayName: result.displayName || '',
          phoneNumber: result.phoneNumber || '',
          dateOfBirth: result.dateOfBirth || '',
          roles: result.roles || ['USER'],
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const roleChanged = useMemo(
    () => user && form && !sameRoles(user.roles, form.roles),
    [form, user],
  );

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = {};
      if (form.displayName !== (user.displayName || '')) body.displayName = form.displayName;
      if (form.phoneNumber !== (user.phoneNumber || '')) body.phoneNumber = form.phoneNumber;
      if (form.dateOfBirth !== (user.dateOfBirth || '')) body.dateOfBirth = form.dateOfBirth;
      if (adminRole === 'SUPER_ADMIN' && roleChanged) {
        body.roles = form.roles;
        body.reason = reason;
      }
      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }
      const updated = await adminService.updateUser(userId, body);
      setUser(updated);
      setForm({
        displayName: updated.displayName || '',
        phoneNumber: updated.phoneNumber || '',
        dateOfBirth: updated.dateOfBirth || '',
        roles: updated.roles || ['USER'],
      });
      setReason('');
      onUpdated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async () => {
    const actionLabel = user.status === 'SUSPENDED' ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Xác nhận ${actionLabel} tài khoản ${user.displayName || user.id}?`)) {
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (user.status === 'SUSPENDED') {
        await adminService.reactivateUser(user.id, reason);
      } else {
        await adminService.suspendUser(user.id, reason);
      }
      const refreshed = await adminService.getUser(user.id);
      setUser(refreshed);
      setForm((current) => ({ ...current, roles: refreshed.roles }));
      setReason('');
      onUpdated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRole = (role) => {
    if (role === 'USER' || userId === currentUserId) return;
    const roles = form.roles.includes(role)
      ? form.roles.filter((item) => item !== role)
      : [...form.roles, role];
    setForm({ ...form, roles: [...new Set(['USER', ...roles])] });
  };

  const readOnly = user?.status === 'DELETED';

  return (
    <Modal
      onClose={onClose}
      subtitle={user ? `ID ${user.id}` : 'Đang tải hồ sơ từ server'}
      title="Chi tiết người dùng"
    >
      <div className={styles.modalBody}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {loading && <div className={styles.emptyInline}>Đang tải hồ sơ...</div>}
        {!loading && form && user && (
          <>
            <div className={styles.userDetailSummary}>
              <span className={styles.userAvatarLarge}>{user.displayName?.slice(0, 1).toUpperCase() || 'U'}</span>
              <div>
                <strong>{user.displayName || 'Chưa cập nhật tên'}</strong>
                <span>Tham gia {formatDate(user.createdAt)}</span>
              </div>
              <Badge tone={formatStatus(user.status).tone}>{formatStatus(user.status).label}</Badge>
            </div>

            <form onSubmit={save}>
              <div className={styles.formGrid}>
                <Field
                  disabled={readOnly}
                  label="Họ và tên"
                  maxLength={120}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  required
                  value={form.displayName}
                />
                <Field
                  disabled={readOnly}
                  label="Số điện thoại"
                  onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                  required
                  value={form.phoneNumber}
                />
                <Field
                  disabled={readOnly}
                  label="Ngày sinh"
                  min="1900-01-01"
                  onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                  required
                  type="date"
                  value={form.dateOfBirth}
                />
                <div className={styles.readonlyField}>
                  <span>Hạng / EXP</span>
                  <strong>{user.rankCode} · {user.expPoints} EXP</strong>
                </div>
              </div>

              {adminRole === 'SUPER_ADMIN' && (
                <fieldset className={styles.roleFieldset} disabled={readOnly || userId === currentUserId}>
                  <legend>Vai trò sản phẩm</legend>
                  <div>
                    {['USER', 'ADMIN', 'SUPER_ADMIN'].map((role) => (
                      <label key={role}>
                        <input
                          checked={form.roles.includes(role)}
                          disabled={role === 'USER'}
                          onChange={() => toggleRole(role)}
                          type="checkbox"
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                  {userId === currentUserId && <small>Không thể tự thay đổi vai trò của chính mình.</small>}
                </fieldset>
              )}

              <label className={styles.formField}>
                <span>Lý do quản trị {roleChanged || user.status !== 'DELETED' ? '(tối thiểu 10 ký tự khi đổi quyền/trạng thái)' : ''}</span>
                <textarea
                  disabled={readOnly}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Mô tả lý do và căn cứ xử lý"
                  value={reason}
                />
              </label>

              <div className={styles.userActionBar}>
                <div>
                  <strong>Trạng thái tài khoản</strong>
                  <span>Khóa tài khoản sẽ thu hồi phiên cục bộ và vô hiệu push token.</span>
                </div>
                {user.status !== 'DELETED' && user.id !== currentUserId && (
                  <button
                    className={user.status === 'SUSPENDED' ? styles.secondaryButton : styles.dangerButton}
                    disabled={submitting || reason.trim().length < 10}
                    onClick={changeStatus}
                    type="button"
                  >
                    {user.status === 'SUSPENDED' ? 'Mở khóa' : 'Khóa tài khoản'}
                  </button>
                )}
              </div>

              <footer className={styles.modalFooter}>
                <button className={styles.secondaryButton} disabled={submitting} onClick={onClose} type="button">
                  Đóng
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={readOnly || submitting || (roleChanged && reason.trim().length < 10)}
                  type="submit"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </footer>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function AdminUsersSection({ adminRole, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const requestSequence = useRef(0);

  const loadUsers = useCallback(async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');
    try {
      const result = await adminService.listUsers({
        page,
        pageSize: PAGE_SIZE,
        keyword,
        status,
        role,
      });
      if (requestSequence.current === requestId) {
        setUsers(result.items || []);
        setTotal(result.total || 0);
      }
    } catch (requestError) {
      if (requestSequence.current === requestId) {
        setUsers([]);
        setTotal(0);
        setError(requestError.message);
      }
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false);
      }
    }
  }, [keyword, page, role, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  const refreshAfterMutation = () => {
    loadUsers();
  };

  return (
    <>
      <section className={`${styles.panel} ${styles.userManagement}`}>
        <div className={styles.userSectionHeader}>
          <div>
            <span className={styles.eyebrow}>Danh mục tài khoản</span>
            <h2>Người dùng TrustBite</h2>
            <p>Hồ sơ và quyền được xác thực lại trên server ở mọi thao tác.</p>
          </div>
          <button className={styles.primaryButton} onClick={() => setCreateOpen(true)} type="button">
            Thêm người dùng
          </button>
        </div>

        <div className={styles.userStats}>
          <div><span>Tổng kết quả</span><strong>{total}</strong></div>
          <div><span>Trang hiện tại</span><strong>{page} / {pageCount}</strong></div>
          <div><span>Quyền phiên</span><strong>{adminRole}</strong></div>
        </div>

        <div className={styles.userFilters}>
          <form className={styles.searchBox} onSubmit={submitSearch}>
            <AdminIcon name="search" size={18} />
            <input
              aria-label="Tìm người dùng"
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="Tìm theo tên, số điện thoại hoặc ID"
              type="search"
              value={keywordInput}
            />
          </form>
          <select
            aria-label="Lọc trạng thái"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            value={status}
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="SUSPENDED">Tạm khóa</option>
            <option value="DELETED">Đã xóa</option>
          </select>
          <select
            aria-label="Lọc vai trò"
            onChange={(event) => {
              setPage(1);
              setRole(event.target.value);
            }}
            value={role}
          >
            <option value="">Mọi vai trò</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
          <button aria-label="Tải lại danh sách" className={styles.iconButton} onClick={loadUsers} type="button">
            <AdminIcon name="refresh" size={18} />
          </button>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            {error}
            <button className={styles.textButton} onClick={loadUsers} type="button">Thử lại</button>
          </div>
        )}

        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Liên hệ</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tham gia</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6"><div className={styles.emptyInline}>Đang tải danh sách người dùng...</div></td></tr>
              )}
              {!loading && users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.entityCell}>
                      <span className={styles.entityAvatar}>{user.displayName?.slice(0, 1).toUpperCase() || 'U'}</span>
                      <div>
                        <strong>{user.displayName || 'Chưa cập nhật tên'}</strong>
                        <span>{user.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.phoneNumberMasked || 'Chưa cập nhật'}</td>
                  <td>
                    <div className={styles.roleBadges}>
                      {(user.roles || ['USER']).map((userRole) => <Badge key={userRole}>{userRole}</Badge>)}
                    </div>
                  </td>
                  <td><Badge tone={formatStatus(user.status).tone}>{formatStatus(user.status).label}</Badge></td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button
                      className={styles.smallButton}
                      disabled={adminRole === 'ADMIN' && user.roles?.includes('SUPER_ADMIN')}
                      onClick={() => setSelectedUserId(user.id)}
                      title={adminRole === 'ADMIN' && user.roles?.includes('SUPER_ADMIN')
                        ? 'ADMIN không được xem hồ sơ SUPER_ADMIN'
                        : 'Xem chi tiết người dùng'}
                      type="button"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && !error && (
                <tr>
                  <td colSpan="6">
                    <div className={styles.userEmptyState}>
                      <span><AdminIcon name="users" size={24} /></span>
                      <strong>Không tìm thấy người dùng</strong>
                      <p>Thử thay đổi từ khóa hoặc bộ lọc hiện tại.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className={styles.pagination}>
          <span>Hiển thị tối đa {PAGE_SIZE} người dùng mỗi trang</span>
          <div>
            <button
              className={styles.secondaryButton}
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Trước
            </button>
            <Badge>{page} / {pageCount}</Badge>
            <button
              className={styles.secondaryButton}
              disabled={page >= pageCount || loading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Sau
            </button>
          </div>
        </footer>
      </section>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={refreshAfterMutation}
        />
      )}
      {selectedUserId && (
        <UserDetailModal
          adminRole={adminRole}
          currentUserId={currentUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdated={refreshAfterMutation}
          userId={selectedUserId}
        />
      )}
    </>
  );
}
