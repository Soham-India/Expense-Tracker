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
import { useRegisterMutation } from "@/features/auth/authApi";
import { getApiError } from "@/lib/apiError";
import { useMounted } from "@/lib/useMounted";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated, setCredentials } from "@/store/slices/authSlice";

const registerSchema = z.object({
  displayName: z
    .string()
    .min(2, "At least 2 characters")
    .max(120, "At most 120 characters"),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(72, "At most 72 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authed = useAppSelector((s) => selectIsAuthenticated(s.auth));
  const [registerUser, { isLoading }] = useRegisterMutation();
  const mounted = useMounted();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  useEffect(() => {
    if (mounted && authed) router.replace("/");
  }, [mounted, authed, router]);

  async function onSubmit(values: RegisterValues) {
    try {
      const res = await registerUser(values).unwrap();
      dispatch(
        setCredentials({
          token: res.token,
          expiresInMs: res.expiresInMs,
          user: res.user,
        }),
      );
      // Registration seeds 6 categories + the self Person record server-side.
      toast.success(`Welcome, ${res.user.displayName}! Your workspace is ready.`);
      router.replace("/");
    } catch (err) {
      const info = getApiError(err);
      if (info.fieldErrors) {
        for (const [field, message] of Object.entries(info.fieldErrors)) {
          setError(field as keyof RegisterValues, { message });
        }
      }
      toast.error(info.message);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Starts with 6 default categories and your self person record."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-ideal-700 dark:text-ideal-300 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Display name"
          autoComplete="name"
          placeholder="Soham"
          required
          error={errors.displayName?.message}
          {...register("displayName")}
        />
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
          autoComplete="new-password"
          placeholder="8-72 characters"
          hint="Between 8 and 72 characters."
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" loading={isLoading} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
