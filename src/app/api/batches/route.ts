import { NextRequest, NextResponse } from 'next/server';
import { processBatchUpload, UploadFileInput } from '@/services/upload.service';
import { verifySignedUserId, COOKIE_NAME, ONE_YEAR_SECONDS } from '@/lib/security';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
    const userId = verifySignedUserId(rawCookie);

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const formData = await req.formData();
    const files: UploadFileInput[] = [];

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          filename: value.name || 'receipt',
          buffer: Buffer.from(arrayBuffer),
        });
      }
    }

    const result = await processBatchUpload(files, userId, clientIp);

    const response = NextResponse.json(
      {
        batchId: result.batchId,
        receipts: result.receipts,
      },
      { status: 202 } // HTTP 202 Accepted (TR-11, FR-5)
    );

    // Set signed 1-year cookie (FR-20)
    response.cookies.set({
      name: COOKIE_NAME,
      value: result.signedCookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { errorCode: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /api/batches error]:', message);
    return NextResponse.json(
      { errorCode: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

