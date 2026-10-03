import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

/** Request body for changing a password. The "repeat it" check is client-side only, like on signup. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(200, "That password is too long"),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Your new password must be different from the current one",
    path: ["newPassword"],
  });
