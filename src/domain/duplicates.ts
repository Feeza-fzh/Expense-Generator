import { Flag } from './checks';

export interface ReceiptForDuplicateCheck {
  id: string;
  fileSha256?: string | null;
  merchantNormalized?: string | null;
  purchaseDate?: Date | string | null;
  totalMinor?: number | null;
  createdAt: Date | string;
}

/**
 * Checks a receipt against existing unexpired done receipts for duplicates.
 * Returns duplicate flags to append to the later receipt.
 * The later receipt is flagged, and the flag carries `otherReceiptId`.
 * Nothing is ever deleted or merged (Rule N-15).
 */
export function findDuplicateFlags(
  current: ReceiptForDuplicateCheck,
  allUserReceipts: ReceiptForDuplicateCheck[]
): Flag[] {
  const flags: Flag[] = [];
  const currentCreatedTime = new Date(current.createdAt).getTime();

  for (const existing of allUserReceipts) {
    if (existing.id === current.id) {
      continue;
    }

    const existingCreatedTime = new Date(existing.createdAt).getTime();
    // Only flag the later receipt (or secondary if timestamps match exactly)
    const isLater =
      currentCreatedTime > existingCreatedTime ||
      (currentCreatedTime === existingCreatedTime && current.id > existing.id);

    if (!isLater) {
      continue;
    }

    // 1. Exact file duplicate check (by SHA-256)
    if (
      current.fileSha256 &&
      existing.fileSha256 &&
      current.fileSha256 === existing.fileSha256
    ) {
      flags.push({
        code: 'DUPLICATE_EXACT_FILE',
        otherReceiptId: existing.id,
        detail: `Exact duplicate file matches receipt ${existing.id}`,
      });
      continue; // Don't double flag with suspected if exact matches
    }

    // 2. Suspected duplicate check (normalized merchant + purchase date + totalMinor)
    if (
      current.merchantNormalized &&
      existing.merchantNormalized &&
      current.merchantNormalized === existing.merchantNormalized &&
      current.totalMinor !== null &&
      current.totalMinor !== undefined &&
      existing.totalMinor !== null &&
      existing.totalMinor !== undefined &&
      current.totalMinor === existing.totalMinor
    ) {
      const curDateStr = formatDateOnly(current.purchaseDate);
      const exDateStr = formatDateOnly(existing.purchaseDate);

      if (curDateStr && exDateStr && curDateStr === exDateStr) {
        flags.push({
          code: 'DUPLICATE_SUSPECTED',
          otherReceiptId: existing.id,
          detail: `Suspected duplicate matches receipt ${existing.id} (merchant: ${current.merchantNormalized}, date: ${curDateStr}, total: ${current.totalMinor})`,
        });
      }
    }
  }

  return flags;
}

function formatDateOnly(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

