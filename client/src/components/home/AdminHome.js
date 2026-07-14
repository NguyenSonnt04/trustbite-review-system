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
            <label>
              Email quản trị
              <span className={styles.inputShell}>
                <AdminIcon name="mail" size={16} />
                <input disabled name="email" placeholder="Đăng nhập chưa khả dụng" type="email" />
              </span>
            </label>
            <label>
              Mật khẩu
              <span className={styles.inputShell}>
                <AdminIcon name="key" size={16} />
                <input
                  disabled
                  name="password"
                  placeholder="Đăng nhập chưa khả dụng"
                  type="password"
                />
              </span>
            </label>

            <div className={styles.formNotice} role="status">
              <AdminIcon name="info" size={17} />
              <p>Đăng nhập web chưa sẵn sàng. Các trường bên dưới được khóa để không thu thập thông tin đăng nhập khi chưa có luồng xác thực an toàn.</p>
            </div>

            <button className={styles.loginButton} disabled type="button">
              <span>Đăng nhập chưa khả dụng</span>
              <AdminIcon name="arrow" size={16} />
            </button>
          </div>

          <div className={styles.preview}>
            <span>Cần xem giao diện hiện tại?</span>
            <Link href="/admin/preview">Mở bản xem chỉ đọc <AdminIcon name="arrow" size={13} /></Link>
          </div>

          <p className={styles.securityCopy}>
            Bản xem chỉ sử dụng dữ liệu công khai và không mở khóa thao tác quản trị.
            Khi đăng nhập được triển khai, mọi quyền vẫn phải được server xác minh.
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
