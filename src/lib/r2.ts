// Cloudflare R2 — nuestro storage principal (reemplaza a Vercel Blob).
// 10 GB gratis, egress gratis, compatible S3. API mínima: put, get, del.
// Los archivos públicos se sirven vía R2_PUBLIC_URL (dominio pub-*.r2.dev).
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET = process.env.R2_BUCKET ?? "";
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET) {
    throw new Error("R2 no configurado (faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });
  return _client;
}

export function isR2Configured(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && BUCKET && R2_PUBLIC_URL);
}

// Sube un archivo (o buffer) a R2 público. Devuelve la URL pública.
export async function r2Put(key: string, body: Buffer | string, contentType: string): Promise<string> {
  await client().send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

// Trae el contenido de un archivo (texto). Null si no existe.
export async function r2GetText(key: string): Promise<string | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return await res.Body?.transformToString() ?? null;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.$metadata?.httpStatusCode === 404 || (e as any)?.name === "NoSuchKey") return null;
    throw e;
  }
}

// ¿Existe la key? (para saber si ya está sin bajar el contenido)
export async function r2Exists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// URL pública de una key (sin verificar si existe).
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

// Borra una key.
export async function r2Delete(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
