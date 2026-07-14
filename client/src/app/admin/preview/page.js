import AdminPortal from '@/components/admin/AdminPortal';

export const metadata = {
  title: 'Bản xem quản trị | TrustBite',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPreviewPage() {
  return <AdminPortal preview />;
}
