import Link from 'next/link';
import AdminIcon from '@/components/admin/AdminIcon';
import styles from '@/app/page.module.css';

export default function AdminHome() {
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

          <div className={styles.form}>
            <div className={styles.formNotice} role="status">
              <AdminIcon name="info" size={17} />
              <p>Đăng nhập được chuyển đến Cognito Hosted UI bằng Authorization Code + PKCE. TrustBite không thu thập mật khẩu trên trang này.</p>
            </div>

            <Link className={styles.loginButton} href="/admin">
              <span>Mở cổng quản trị</span>
              <AdminIcon name="arrow" size={16} />
            </Link>
            <Link className={styles.merchantButton} href="/merchant">
              <span>Mở cổng nhà hàng</span>
              <AdminIcon name="store" size={16} />
            </Link>
          </div>

          <div className={styles.preview}>
            <span>Bản xem quản trị đã được khóa.</span>
            <strong>Cần phiên quản trị hợp lệ để truy cập.</strong>
          </div>

          <p className={styles.securityCopy}>
            Không có đường xem công khai vào workspace quản trị. Cognito xác thực danh tính,
            còn mọi quyền ADMIN, OWNER và MANAGER vẫn được server TrustBite xác minh.
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
