import { ContentTooLargeError } from './content/errors';

export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function configuredUploadLimit(name: string, maximum: number): number {
  const configured = Number(process.env[name]);
  if (!Number.isSafeInteger(configured) || configured <= 0) return maximum;
  return Math.min(configured, maximum);
}

export function assertByteLengthWithinLimit(
  actualBytes: number,
  environmentName: string,
  maximum: number,
  label: string,
): void {
  const limitBytes = configuredUploadLimit(environmentName, maximum);
  if (actualBytes > limitBytes) {
    throw new ContentTooLargeError(
      `${label} exceeds the configured size limit.`,
      { actualBytes, limitBytes },
    );
  }
}

export function assertTextWithinLimit(
  content: string,
  environmentName: string,
  maximum: number,
  label: string,
): void {
  assertByteLengthWithinLimit(
    Buffer.byteLength(content, 'utf8'),
    environmentName,
    maximum,
    label,
  );
}
