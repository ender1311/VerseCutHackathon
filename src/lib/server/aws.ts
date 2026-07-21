import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { publicS3Url } from '../export/awsPath';

export interface AwsEnv {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  publicBase?: string;
}

export function getAwsEnv(): AwsEnv | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    region: process.env.AWS_REGION || 'us-east-1',
    publicBase: process.env.AWS_PUBLIC_BASE || undefined,
  };
}

let cached: { client: S3Client; key: string } | null = null;
function clientFor(env: AwsEnv): S3Client {
  const key = `${env.region}:${env.accessKeyId}`;
  if (cached && cached.key === key) return cached.client;
  const client = new S3Client({
    region: env.region,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
  });
  cached = { client, key };
  return client;
}

/** Upload bytes to S3 (public-read) and return the public URL. */
export async function uploadToS3(
  bytes: Uint8Array,
  opts: { key: string; mime: string; env: AwsEnv },
): Promise<{ url: string }> {
  const { env } = opts;
  await clientFor(env).send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: opts.key,
      Body: bytes,
      ContentType: opts.mime,
      ACL: 'public-read',
    }),
  );
  return { url: publicS3Url(env.bucket, opts.key, env.publicBase) };
}
