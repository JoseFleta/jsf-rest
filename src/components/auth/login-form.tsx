"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath?: string;
};

function mapSignInError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }
  if (normalized.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return "We could not sign you in. Please try again.";
}

function mapSignUpError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered")) {
    return "This email already has an account. Sign in instead.";
  }
  if (normalized.includes("password")) {
    return "Use a stronger password (at least 6 characters).";
  }
  if (normalized.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return "We could not create your account. Please try again.";
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitLabel = useMemo(() => (mode === "signin" ? "Sign In" : "Sign Up"), [mode]);
  const destination = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setMessage(null);
    setErrorMessage(null);

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setIsSubmitting(false);

      if (error) {
        setErrorMessage(mapSignInError(error.message));
        return;
      }

      router.push(destination);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setIsSubmitting(false);
      setErrorMessage(mapSignUpError(error.message));
      return;
    }

    if (data.session) {
      setIsSubmitting(false);
      router.push(destination);
      router.refresh();
      return;
    }

    const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInAfterSignUpError) {
      setErrorMessage(mapSignInError(signInAfterSignUpError.message));
      return;
    }

    router.push(destination);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/70 p-1">
        <Button
          type="button"
          variant={mode === "signin" ? "default" : "ghost"}
          className="rounded-lg"
          onClick={() => {
            setMode("signin");
            setMessage(null);
            setErrorMessage(null);
          }}
        >
          Sign In
        </Button>
        <Button
          type="button"
          variant={mode === "signup" ? "default" : "ghost"}
          className="rounded-lg"
          onClick={() => {
            setMode("signup");
            setMessage(null);
            setErrorMessage(null);
          }}
        >
          Sign Up
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@restaurant.com"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {mode === "signin" ? (
        <p className="text-xs text-muted-foreground">
          If this is your first time, switch to <strong>Sign Up</strong>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Already have an account? Switch to <strong>Sign In</strong>.
        </p>
      )}
    </form>
  );
}
