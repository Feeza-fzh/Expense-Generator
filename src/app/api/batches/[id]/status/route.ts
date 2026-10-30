import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { verifySignedUserId, COOKIE_NAME } from '@/lib/security';
import { getReceiptErrorMessage } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: batchId } = await params;
  const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
  const userId = verifySignedUserId(rawCookie);

  if (!userId) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  // N-20: Check ownership on every route. Return 404 for another user's data.
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      receipts: {
        select: {
          id: true,
          originalFilename: true,
          status: true,
          errorCode: true,
        },
      },
      report: {
        select: {
          id: true,
          summaryStatus: true,
        },
      },
    },
  });

  if (!batch || batch.userId !== userId) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const receiptsStatus = batch.receipts.map((r) => ({
    id: r.id,
    originalFilename: r.originalFilename,
    status: r.status,
    errorCode: r.errorCode,
    errorMessage: r.errorCode ? getReceiptErrorMessage(r.errorCode) : null,
  }));

  const reportReady = Boolean(batch.report);
  const summaryStatus = batch.report?.summaryStatus ?? 'NOT_REQUESTED';

  return NextResponse.json({
    batchId: batch.id,
    reportReady,
    summaryStatus,
    receipts: receiptsStatus,
  });
}

