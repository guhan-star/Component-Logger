/**
 * Stark Industries WMC — Cloud Storage Provider (Supabase Storage)
 * Handles secure uploads, validation, signed URL generation, and bucket isolation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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

export type StorageBucket = 'component-images' | 'datasheets' | 'receipts' | 'project-attachments';

const ALLOWED_MIME_TYPES: Record<StorageBucket, string[]> = {
  'component-images': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}

export async function uploadPrivateFile(
  bucket: StorageBucket,
  ownerId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  mimeType: string
): Promise<UploadResult> {
  // 1. Validate file size
  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return { success: false, error: 'File size exceeds maximum allowed limit (10MB).' };
  }

  // 2. Validate MIME type
  const allowed = ALLOWED_MIME_TYPES[bucket] || [];
  if (!allowed.includes(mimeType.toLowerCase())) {
    return { success: false, error: `Invalid file type (${mimeType}) for bucket ${bucket}.` };
  }

  // 3. Generate sanitized object path: {ownerId}/{timestamp}-{cleanName}
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${ownerId}/${Date.now()}-${cleanName}`;

  if (!supabaseClient) {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error: 'Cloud storage service is not configured. Contact your administrator to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      };
    }
    // Local development sandbox fallback only
    return {
      success: true,
      storagePath: `local://${storagePath}`,
      signedUrl: `data:${mimeType};base64,${Buffer.from(fileBuffer).toString('base64')}`,
    };
  }

  try {
    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Generate initial signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    return {
      success: true,
      storagePath,
      signedUrl: signedData?.signedUrl || undefined,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Storage upload error.' };
  }
}

export async function getSignedFileUrl(
  bucket: StorageBucket,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (storagePath.startsWith('local://') || storagePath.startsWith('data:')) {
    return storagePath;
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

export async function deleteStorageFile(
  bucket: StorageBucket,
  storagePath: string
): Promise<boolean> {
  if (storagePath.startsWith('local://')) return true;
  if (!supabaseClient) return true;

  try {
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([storagePath]);

    return !error;
  } catch {
    return false;
  }
}
