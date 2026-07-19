'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import styles from './page.module.css';

const resolveSafeReturnTo = (returnTo) => {
  try {
    const target = new URL(returnTo || '/', window.location.origin);
    if (target.origin !== window.location.origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
};

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Đang hoàn tất đăng nhập với Cognito...');

  useEffect(() => {
    const complete = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error_description') || params.get('error');
      if (error) {
        await Promise.resolve();
        setMessage(error);
        return;
      }

      try {
        const returnTo = await authService.completeLogin({
          code: params.get('code'),
          state: params.get('state'),
        });
        window.location.replace(resolveSafeReturnTo(returnTo));
      } catch (callbackError) {
        setMessage(callbackError.message || 'Không thể hoàn tất đăng nhập.');
      }
    };
    complete();
  }, []);

  return (
    <main className={styles.page}>
      <span>T</span>
      <h1>Xác thực TrustBite</h1>
      <p>{message}</p>
      <Link href="/">Trở về trang chủ</Link>
    </main>
  );
}
