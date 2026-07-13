'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import AdminIcon from '@/components/admin/AdminIcon';
import styles from '@/app/page.module.css';

export default function AdminHome() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await authService.login();
    } catch {
      setError('Phiên đăng nhập quản trị đang được hoàn thiện. Hiện tại, bạn có thể tiếp tục với bản quản trị chỉ đọc.');
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

          <form className={styles.form} onSubmit={handleLogin}>
            <label>
              Email quản trị
              <span className={styles.inputShell}>
                <AdminIcon name="mail" size={16} />
                <input autoComplete="username" name="email" placeholder="admin@trustbite.com" type="email" />
              </span>
            </label>
            <label>
              Mật khẩu
              <span className={styles.inputShell}>
                <AdminIcon name="key" size={16} />
                <input
                  autoComplete="current-password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                />
                <button
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  <AdminIcon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </span>
            </label>

            {error && (
              <div className={styles.formNotice} role="status">
                <AdminIcon name="info" size={17} />
                <p>{error}</p>
              </div>
            )}

            <button className={styles.loginButton} disabled={submitting} type="submit">
              <span>{submitting ? 'Đang kiểm tra...' : 'Đăng nhập'}</span>
              <AdminIcon name="arrow" size={16} />
            </button>
          </form>

          <div className={styles.preview}>
            <span>Chưa có phiên đăng nhập web?</span>
            <Link href="/admin">Mở bản quản trị chỉ đọc <AdminIcon name="arrow" size={13} /></Link>
          </div>

          <p className={styles.securityCopy}>
            TrustBite không lưu mật khẩu trong trình duyệt. Mọi quyền quản trị
            được server xác minh lại trước khi thực thi.
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
