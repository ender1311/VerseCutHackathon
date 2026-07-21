import { withAuth } from '@workos-inc/authkit-nextjs';
import { BulkExport } from '../../components/BulkExport';

export default async function ExportPage() {
  const { user } = await withAuth();
  return <BulkExport userEmail={user?.email ?? null} />;
}
