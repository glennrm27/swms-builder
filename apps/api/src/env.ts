import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  STORAGE_DRIVER: z.enum(["local", "azure"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional(),
  SOFFICE_PATH: z.string().default("soffice"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

// Fail fast and loudly on boot if config is invalid, instead of a mystery
// crash the first time a request touches the missing value.
export const env = envSchema.parse(process.env);
