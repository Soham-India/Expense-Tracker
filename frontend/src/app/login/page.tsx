"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { useLoginMutation } from "@/features/auth/authApi";
import { getApiError } from "@/lib/apiError";
import { useMounted } from "@/lib/useMounted";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated, setCredentials } from "@/store/slices/authSlice";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authed = useAppSelector((s) => selectIsAuthenticated(s.auth));
  const [login, { isLoading }] = useLoginMutation();
  const mounted = useMounted();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (mounted && authed) router.replace("/");
  }, [mounted, authed, router]);

  async function onSubmit(values: LoginValues) {
    try {
      const res = await login(values).unwrap();
      dispatch(
        setCredentials({
          token: res.token,
          expiresInMs: res.expiresInMs,
          user: res.user,
        }),
      );
      toast.success(`Welcome back, ${res.user.displayName}`);
      router.replace("/");
    } catch (err) {
      const info = getApiError(err);
      if (info.fieldErrors) {
        for (const [field, message] of Object.entries(info.fieldErrors)) {
          setError(field as keyof LoginValues, { message });
        }
      }
      toast.error(info.message);
    }
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Pick up where your three systems left off."
      footer={
        <>
          New here?{" "}
          <Link
            href="/register"
            className="font-medium text-ideal-700 dark:text-ideal-300 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" loading={isLoading} className="w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
