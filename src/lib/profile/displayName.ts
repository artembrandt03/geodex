import { z } from "zod";
import { containsProfanity } from "../validation";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

/** One set of rules for picking a display name, at signup and when changing it later. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN, `Display names need at least ${DISPLAY_NAME_MIN} characters`)
  .max(DISPLAY_NAME_MAX, `Display names can be up to ${DISPLAY_NAME_MAX} characters`)
  .refine((name) => !containsProfanity(name), {
    message: "That display name isn't allowed. Please choose another.",
  });
