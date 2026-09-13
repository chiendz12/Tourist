import { redirect } from "next/navigation";
import { authApi } from "@/lib/api/services";

/**
 * Studio entry point: routes each role straight to its Figma dashboard.
 * Lecturers/leaders get the class overview, admins the system overview,
 * students their data workspace, members the account dashboard.
 */
export default async function StudioPage() {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio");
  if (me.role === "SUPER_ADMIN") redirect("/studio/admin");
  if (me.role === "LECTURER" || me.role === "LEADER") redirect("/studio/lecturer");
  if (me.role === "STUDENT") redirect("/studio/mine");
  redirect("/me");
}
