import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { Sidebar, type SidebarUser } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /* ── Fetch profile from `profiles` table ── */
  let displayName: string | null = null;
  let plan = "free";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, plan")
    .eq("id", user.id)
    .single();

  if (profile) {
    displayName = profile.display_name ?? null;
    plan = profile.plan ?? "free";
  }

  /* ── Build sidebar user object ── */
  const sidebarUser: SidebarUser = {
    email: user.email ?? "",
    name:
      displayName ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      null,
    avatarUrl:
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null,
    plan,
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar user={sidebarUser} />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={sidebarUser} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
