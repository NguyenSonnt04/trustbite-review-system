import AdminPortal from '@/components/admin/AdminPortal';

export const metadata = {
  title: 'Quản trị | TrustBite',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminPortal />;
}
