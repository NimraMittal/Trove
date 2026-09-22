import { z } from "zod";

export const registrationSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254)),

  password: z.string().min(15).max(128),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;