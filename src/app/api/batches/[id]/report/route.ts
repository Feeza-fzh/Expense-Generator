import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db';
import { verifySignedUserId, COOKIE_NAME } from '@/lib/security';
import { getReceiptErrorMessage } from '@/lib/errors';
import { formatMinorAmount } from '@/domain/money';

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

  // N-20: Check ownership. Return 404 for another user's data.
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      report: true,
      receipts: {
        include: {
          lineItems: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!batch || batch.userId !== userId || !batch.report) {
    return NextResponse.json({ message: 'Report not ready or not found' }, { status: 404 });
  }

  // A-8: Format amounts on the server so components do not reformat or compute money
  const rawTotals = batch.report.totals as any;
  const formattedTotals = {
    ...rawTotals,
    byCurrency: Object.fromEntries(
      Object.entries(rawTotals.byCurrency || {}).map(([currency, cVal]: [string, any]) => [
        currency,
        {
          ...cVal,
          totalFormatted: formatMinorAmount(cVal.totalMinor, currency),
          byCategory: Object.fromEntries(
            Object.entries(cVal.byCategory || {}).map(([category, catVal]: [string, any]) => [
              category,
              {
                ...catVal,
                totalFormatted: formatMinorAmount(catVal.totalMinor, currency),
              },
            ])
          ),
        },
      ])
    ),
  };

  const receiptsData = batch.receipts.map((r) => ({
    id: r.id,
    originalFilename: r.originalFilename,
    status: r.status,
    errorCode: r.errorCode,
    errorMessage: r.errorCode ? getReceiptErrorMessage(r.errorCode) : null,
    merchant: r.merchant,
    date: r.purchaseDate ? r.purchaseDate.toISOString().slice(0, 10) : null,
    dateRaw: r.dateRaw,
    dateAmbiguous: r.dateAmbiguous,
    currency: r.currency,
    subtotalMinor: r.subtotalMinor,
    subtotalFormatted: formatMinorAmount(r.subtotalMinor, r.currency),
    taxMinor: r.taxMinor,
    taxFormatted: formatMinorAmount(r.taxMinor, r.currency),
    tipMinor: r.tipMinor,
    tipFormatted: formatMinorAmount(r.tipMinor, r.currency),
    totalMinor: r.totalMinor,
    totalFormatted: formatMinorAmount(r.totalMinor, r.currency),
    category: r.category ? r.category.toLowerCase() : null,
    legibility: r.legibility ? r.legibility.toLowerCase() : null,
    flags: r.flags,
    sourceUrl: r.storageKey ? `/api/receipts/${r.id}/source` : null,
    lineItems: r.lineItems.map((li) => ({
      position: li.position,
      description: li.description,
      quantity: li.quantity ? String(li.quantity) : null,
      amountMinor: li.amountMinor,
      amountFormatted: formatMinorAmount(li.amountMinor, r.currency),
    })),
  }));

  return NextResponse.json({
    batchId: batch.id,
    includedCount: batch.report.includedCount,
    totalCount: batch.report.totalCount,
    totals: formattedTotals,
    summary: batch.report.summary,
    summaryStatus: batch.report.summaryStatus,
    expiresAt: batch.expiresAt.toISOString(),
    legalNotice: 'This is a working summary of your receipts. It is not a tax or legal record.',
    generatedAt: batch.report.generatedAt.toISOString(),
    receipts: receiptsData,
  });
}
