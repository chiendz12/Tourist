import { redirect } from "next/navigation";
import {
  approvalsApi,
  authApi,
  notificationsApi,
  provincesApi,
} from "@/lib/api/services";
import { ApprovalBoard } from "@/components/studio/approval-board";

/**
 * Approval workflow dashboard: review queue with kanban, filters,
 * statistics and the detail/review panel.
 */
export default async function ApprovalsPage() {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/approvals");
  if (me.role !== "LEADER" && me.role !== "LECTURER" && me.role !== "SUPER_ADMIN") {
    redirect("/studio");
  }

  const [queue, summary, provinces, notifications] = await Promise.all([
    approvalsApi.queue({ limit: 100 }).catch(() => ({ data: [], meta: null as never })),
    approvalsApi
      .summary()
      .catch((): { total: number; pending: number; byStatus: Record<string, number> } => ({
        total: 0,
        pending: 0,
        byStatus: {},
      })),
    provincesApi.list().catch(() => []),
    notificationsApi.list({ limit: 10 }).catch(() => ({ data: [], meta: null as never })),
  ]);

  return (
    <ApprovalBoard
      user={me}
      unread={(notifications.data ?? []).filter((n) => !n.readAt).length}
      items={queue.data ?? []}
      summary={summary}
      provinces={provinces}
    />
  );
}
