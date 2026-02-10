import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Login",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(0_0%_98%),_hsl(0_0%_94%))] p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/70 bg-background/95 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">JSF Rest</CardTitle>
          <CardDescription>
            Sign in or create your account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            nextPath={next && next.startsWith("/") && !next.startsWith("/auth") ? next : undefined}
          />
        </CardContent>
      </Card>
    </main>
  );
}
