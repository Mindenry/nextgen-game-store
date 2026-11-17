import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254)
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(24)
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscore only")
      .optional()
      .or(z.literal("")),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetSchema = z
  .object({
    token: z.string().min(10, "Reset token is missing"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .max(24)
    .regex(/^[a-zA-Z0-9_]*$/, "Use letters, numbers and underscore only")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Enter a valid phone number")
    .optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const depositSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a valid amount")
    .transform((value) => Number(value)),
});

export const ticketSchema = z.object({
  subject: z.string().trim().min(5, "Subject must be at least 5 characters").max(120),
  category: z.enum(["general", "order", "payment", "delivery", "account"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  message: z.string().trim().min(10, "Please describe your issue").max(4000),
});

export const reviewSchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().max(2000).optional(),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
