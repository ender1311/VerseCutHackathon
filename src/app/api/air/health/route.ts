import { getAirEnv } from '@/lib/server/air';
import { getAwsEnv } from '@/lib/server/aws';
import { getBrazeEnv } from '@/lib/server/braze';

// Public, no-secret diagnostic: reports whether each upload destination has
// credentials present in the running environment (no secret values exposed).
export function GET() {
  // Booleans only — no bucket/endpoint/region values on this public endpoint.
  return Response.json({
    air: { configured: !!getAirEnv() },
    aws: { configured: !!getAwsEnv() },
    braze: { configured: !!getBrazeEnv() },
  });
}
