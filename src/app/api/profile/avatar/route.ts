import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { uploadPrivateFile, deleteStorageFile } from '@/lib/storage';

// Allowed MIME types for profile avatars (strictly image formats, no SVG/scripts)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/profile/avatar - Upload profile picture with preview & ownership protection
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Fetch existing user to retain old avatar until new upload and database update succeed
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer;
    let mimeType: string = 'image/jpeg';
    let fileName: string = 'avatar.jpg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      mimeType = file.type.toLowerCase();
      fileName = file.name || 'avatar.jpg';
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Base64 JSON payload
      const body = await request.json();
      const { dataUrl, name } = body;
      if (!dataUrl) {
        return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
      }

      const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 });
      }

      mimeType = matches[1].toLowerCase();
      buffer = Buffer.from(matches[2], 'base64');
      fileName = name || 'avatar.jpg';
    }

    // 1. Validate file size (max 5 MB)
    if (buffer.length > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: 'Avatar image must not exceed 5 MB' }, { status: 400 });
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid image format. Only JPEG, PNG, and WebP images are permitted.' },
        { status: 400 }
      );
    }

    // 3. Upload to avatars bucket (do NOT delete old avatar yet)
    const uploadRes = await uploadPrivateFile('avatars', user.id, fileName, buffer, mimeType);

    if (!uploadRes.success || !uploadRes.signedUrl) {
      return NextResponse.json(
        { error: uploadRes.error || 'Failed to securely store profile picture.' },
        { status: 500 }
      );
    }

    // 4. Update user record in database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: uploadRes.signedUrl },
    });

    // 5. Clean up old avatar from storage ONLY AFTER database update succeeds
    if (currentUser?.avatarUrl && currentUser.avatarUrl !== uploadRes.signedUrl) {
      const match = currentUser.avatarUrl.match(/avatars\/(.+?)(\?|$)/);
      if (match && match[1]) {
        try {
          await deleteStorageFile('avatars', decodeURIComponent(match[1]), user.id);
        } catch (delErr) {
          console.warn('Failed to clean up old avatar:', delErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatarUrl: uploadRes.signedUrl,
      storagePath: uploadRes.storagePath,
    });
  } catch (error: any) {
    console.error('POST /api/profile/avatar error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upload profile picture' }, { status: 500 });
  }
}

// DELETE /api/profile/avatar - Remove profile picture and restore default avatar
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Fetch existing avatar to remove file from storage
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    // Reset user avatar in database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });

    // Clean up storage object if present
    if (currentUser?.avatarUrl) {
      const match = currentUser.avatarUrl.match(/avatars\/(.+?)(\?|$)/);
      if (match && match[1]) {
        try {
          await deleteStorageFile('avatars', decodeURIComponent(match[1]), user.id);
        } catch (delErr) {
          console.warn('Failed to clean up avatar on delete:', delErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed and default avatar restored',
    });
  } catch (error: any) {
    console.error('DELETE /api/profile/avatar error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete avatar' }, { status: 500 });
  }
}
