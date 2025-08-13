import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3020),
  DATABASE_URL: z.string().url(),
  TZ: z.string().default('America/Bogota'),
  BEDS24_WEBHOOK_SECRET: z.string().optional(),
  BEDS24_API_URL: z.string().default('https://api.beds24.com/v2'),
  BEDS24_TOKEN: z.string(),
  BEDS24_TIMEOUT: z.coerce.number().default(45000),
});

export const env = EnvSchema.parse(process.env);

