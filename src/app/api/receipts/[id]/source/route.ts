import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { getStorage } from '@/storage';
import { verifySignedUserId, COOKIE_NAME } from '@/lib/security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: receiptId } = await params;
  const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
  const userId = verifySignedUserId(rawCookie);

  if (!userId) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  // N-20: Check ownership. Return 404 for another user's data.
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || receipt.userId !== userId || !receipt.storageKey) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const storage = getStorage();
  const signedUrl = await storage.getSignedDownloadUrl(receipt.storageKey);

  // Return signed URL
  return NextResponse.json({
    url: signedUrl,
    expiresInSeconds: 300,
  });
}

