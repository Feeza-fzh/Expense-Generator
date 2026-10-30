import { NextRequest, NextResponse } from 'next/server';
import { requestBatchSummary } from '@/services/summary.service';
import { verifySignedUserId, COOKIE_NAME } from '@/lib/security';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: batchId } = await params;
    const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
    const userId = verifySignedUserId(rawCookie);

    if (!userId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const result = await requestBatchSummary(batchId, userId, clientIp);

    return NextResponse.json(result, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { errorCode: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { errorCode: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

