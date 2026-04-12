import { WeblogSection } from '@/components/weblog-section';
import { fetchQuery } from '@/lib/server-convex-client';
import { api } from '../../../../convex/_generated/api';
import { Doc } from '../../../../convex/_generated/dataModel';

export default async function WeblogPage() {
  let initialWeblogs: Doc<"weblogs">[] | undefined;

  try {
    initialWeblogs = await fetchQuery<Doc<"weblogs">[]>(api.weblogs.list);
  } catch (error) {
    console.warn("Failed to fetch weblogs on server:", error);
  }

  return <WeblogSection initialWeblogs={initialWeblogs} />;
}
