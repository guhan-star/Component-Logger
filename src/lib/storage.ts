/**
 * Stark Industries WMC — Cloud Storage Provider (Supabase Storage)
 * Handles secure uploads, validation, signed URL generation, and bucket isolation.
 * Strictly uses server-side service-role credentials with no client-key fallback.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
// Strictly use service-role key; never fallback to anon key for server-side privileged storage operations
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.warn('⚠️ Supabase client initialization error:', err);
  }
}

export type StorageBucket =
  | 'avatars'
  | 'component-images'
  | 'datasheets'
  | 'receipts'
  | 'project-attachments';

const ALLOWED_MIME_TYPES: Record<StorageBucket, string[]> = {
  'avatars': ['image/jpeg', 'image/png', 'image/webp'],
  'component-images': ['image/jpeg', 'image/png', 'image/webp'],
  'datasheets': ['application/pdf', 'text/plain', 'image/png', 'image/jpeg'],
  'receipts': ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  'project-attachments': [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/csv',
  ],
};

const MAX_FILE_SIZE: Record<StorageBucket, number> = {
  'avatars': 5 * 1024 * 1024, // 5MB
  'component-images': 10 * 1024 * 1024,
  'datasheets': 15 * 1024 * 1024,
  'receipts': 10 * 1024 * 1024,
  'project-attachments': 25 * 1024 * 1024,
};

export interface UploadResult {
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}

/**
 * Checks if a storage path belongs to the given user ID to prevent cross-user IDOR access.
 * Path format: {ownerId}/{timestamp}-{cleanName}
 */
export function verifyStoragePathOwnership(storagePath: string, userId: string): boolean {
  if (!storagePath || !userId) return false;
  const normalized = storagePath.replace(/^local:\/\//, '');
  const prefix = `${userId}/`;
  return normalized.startsWith(prefix);
}

/**
 * Uploads a private file with strict size, MIME type, and ownership validation.
 */
export async function uploadPrivateFile(
  bucket: StorageBucket,
  ownerId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  mimeType: string
): Promise<UploadResult> {
  if (!ownerId) {
    return { success: false, error: 'File owner ID is required.' };
  }

  // 1. Validate file size
  const maxSize = MAX_FILE_SIZE[bucket] || 10 * 1024 * 1024;
  if (fileBuffer.byteLength > maxSize) {
    const mbLimit = Math.round(maxSize / (1024 * 1024));
    return { success: false, error: `File size exceeds maximum allowed limit of ${mbLimit} MB.` };
  }

  // 2. Validate MIME type (strictly prevent SVG / scripts)
  const allowed = ALLOWED_MIME_TYPES[bucket] || [];
  const cleanMime = mimeType.toLowerCase().trim();
  if (!allowed.includes(cleanMime)) {
    return { success: false, error: `Invalid file format (${cleanMime}). Disallowed for ${bucket}.` };
  }

  // 3. Generate sanitized object path: {ownerId}/{timestamp}-{cleanName}
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${ownerId}/${Date.now()}-${cleanName}`;

  if (!supabaseClient) {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error:
          'Cloud storage service is not configured. Contact your administrator to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      };
    }
    // Local development sandbox fallback
    return {
      success: true,
      storagePath: `local://${storagePath}`,
      signedUrl: `data:${cleanMime};base64,${Buffer.from(fileBuffer).toString('base64')}`,
    };
  }

  try {
    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: cleanMime,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Generate initial signed URL (valid for 2 hours)
    const { data: signedData, error: signedError } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, 7200);

    return {
      success: true,
      storagePath,
      signedUrl: signedData?.signedUrl || undefined,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Storage upload error.' };
  }
}

/**
 * Generates an authorized signed download URL for private files.
 */
export async function getSignedFileUrl(
  bucket: StorageBucket,
  storagePath: string,
  requestingUserId?: string,
  expiresInSeconds: number = 7200
): Promise<string | null> {
  if (storagePath.startsWith('local://') || storagePath.startsWith('data:')) {
    return storagePath;
  }

  // If requestingUserId is provided, enforce ownership check
  if (requestingUserId && !verifyStoragePathOwnership(storagePath, requestingUserId)) {
    console.warn(`Unauthorized storage access attempt by user ${requestingUserId} on path ${storagePath}`);
    return null;
  }

  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Securely deletes a storage object after verifying user ownership.
 */
export async function deleteStorageFile(
  bucket: StorageBucket,
  storagePath: string,
  requestingUserId?: string
): Promise<boolean> {
  if (storagePath.startsWith('local://')) return true;

  if (requestingUserId && !verifyStoragePathOwnership(storagePath, requestingUserId)) {
    console.warn(`Unauthorized storage delete attempt by user ${requestingUserId} on path ${storagePath}`);
    return false;
  }

  if (!supabaseClient) return true;

  try {
    const cleanPath = storagePath.replace(/^local:\/\//, '');
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([cleanPath]);

    return !error;
  } catch {
    return false;
  }
}
