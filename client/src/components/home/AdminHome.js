'use client';

import Link from 'next/link';
import { useState } from 'react';
import AdminIcon from '@/components/admin/AdminIcon';
import styles from '@/app/page.module.css';
import { authService } from '@/services/auth.service';

export default function AdminHome() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');
    try {
      await authService.login({ email, password });
      window.location.assign('/admin');
    } catch (loginError) {
      setError(loginError.message || 'Dịch vụ đăng nhập đang tạm thời gián đoạn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span>TB</span>
          <div>
            <strong>TrustBite</strong>
            <small>Tin cậy trong từng trải nghiệm</small>
          </div>
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.kicker}>Cổng quản trị TrustBite</span>
          <h1>Trang dành cho<br />nhà quản trị.</h1>
          <p>
            Quản lý nhà hàng, người dùng, xác minh và sức khỏe hệ thống
            trong một không gian vận hành tập trung.
          </p>

          <div className={styles.featureList}>
            <div><AdminIcon name="audit" size={18} /><span>Phân quyền được thực thi tại server</span></div>
            <div><AdminIcon name="monitor" size={18} /><span>Theo dõi trạng thái hệ thống</span></div>
            <div><AdminIcon name="receipt" size={18} /><span>Kiểm soát quy trình xác minh</span></div>
          </div>
        </div>

        <aside className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <span className={styles.loginIcon}><AdminIcon name="lock" size={20} /></span>
            <div>
              <h2>Đăng nhập quản trị</h2>
              <p>Sử dụng tài khoản TrustBite được cấp quyền.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              Email quản trị
              <span className={styles.inputShell}>
                <AdminIcon name="mail" size={16} />
                <input
                  autoComplete="username"
                  disabled={submitting}
                  maxLength={254}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@trustbite.com"
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>
            <label>
              Mật khẩu
              <span className={styles.inputShell}>
                <AdminIcon name="key" size={16} />
                <input
                  autoComplete="current-password"
                  disabled={submitting}
                  maxLength={1024}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  disabled={submitting}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  <AdminIcon name={passwordVisible ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </span>
            </label>

            {error && (
              <div className={`${styles.formNotice} ${styles.formError}`} role="alert">
                <AdminIcon name="info" size={17} />
                <p>{error}</p>
              </div>
            )}

            <button className={styles.loginButton} disabled={submitting} type="submit">
              <span>{submitting ? 'Đang xác minh...' : 'Đăng nhập quản trị'}</span>
              <AdminIcon name="arrow" size={16} />
            </button>
          </form>

          <div className={styles.preview}>
            <span>Workspace quản trị được bảo vệ.</span>
            <strong>Cognito và quyền cục bộ đều được xác minh.</strong>
          </div>

          <p className={styles.securityCopy}>
            Mật khẩu và token Cognito không được lưu trong trình duyệt. Phiên web dùng cookie
            HttpOnly và quyền quản trị được server kiểm tra lại trên mỗi lần truy cập.
          </p>
        </aside>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 TrustBite</span>
        <span>Không gian quản trị bảo mật</span>
      </footer>
    </main>
  );
}
