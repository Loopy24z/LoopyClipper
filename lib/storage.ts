import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
let client: S3Client;
function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error('Configure private R2 storage.');
  client ||= new S3Client({ region: 'auto', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return { client, Bucket: R2_BUCKET };
}
export const storage = {
  async createMultipartUpload(Key: string, options: { httpMetadata: { contentType: string } }) {
    const { client, Bucket } = config();
    const result = await client.send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType: options.httpMetadata.contentType }));
    return { uploadId: result.UploadId! };
  },
  resumeMultipartUpload(Key: string, UploadId: string) {
    const { client, Bucket } = config();
    return {
      async signPart(partNumber: number, size: number) {
        if (!Number.isInteger(size) || size < 1 || size > 8 * 1024 ** 2) throw new Error('Invalid part size.');
        const url = await getSignedUrl(client, new UploadPartCommand({ Bucket, Key, UploadId, PartNumber: partNumber, ContentLength: size }), { expiresIn: 900 });
        return { url, partNumber };
      },
      async complete(parts: { partNumber: number; etag: string }[], expectedSize?: number) {
        const listed = await client.send(new ListPartsCommand({ Bucket, Key, UploadId, MaxParts: 1000 }));
        const actual = listed.Parts || [];
        const total = actual.reduce((n, p) => n + (p.Size || 0), 0);
        const limit = Key.includes('/exports/') ? 1024 ** 3 : 2 * 1024 ** 3;
        if (listed.IsTruncated || !parts.length || parts.length !== actual.length || total > limit || (expectedSize !== undefined && total !== expectedSize) || actual.some((p, i) => p.PartNumber !== i + 1 || parts[i].partNumber !== p.PartNumber || parts[i].etag !== p.ETag || !p.Size || p.Size > 8 * 1024 ** 2 || (i < actual.length - 1 && p.Size !== 8 * 1024 ** 2))) throw new Error('Upload parts or size do not match. Retry the upload.');
        await client.send(new CompleteMultipartUploadCommand({ Bucket, Key, UploadId, MultipartUpload: { Parts: actual.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })) } }));
      },
      async abort() { await client.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId })); },
    };
  },
  async head(Key: string) {
    const { client, Bucket } = config();
    try { const result = await client.send(new HeadObjectCommand({ Bucket, Key })); return { size: result.ContentLength || 0 }; }
    catch (error: any) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
  },
  async signedGet(Key: string, name?: string) {
    const { client, Bucket } = config();
    return getSignedUrl(client, new GetObjectCommand({ Bucket, Key, ResponseCacheControl: 'private, no-store', ...(name ? { ResponseContentDisposition: `attachment; filename="${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}"` } : {}) }), { expiresIn: 3600 });
  },
  async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
    const { client, Bucket } = config();
    const result = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: cursor }));
    return { objects: (result.Contents || []).map(p => ({ key: p.Key! })), truncated: result.IsTruncated, cursor: result.NextContinuationToken };
  },
  async delete(keys: string[]) {
    const { client, Bucket } = config();
    if (!keys.length) return;
    const result = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.map(Key => ({ Key })) } }));
    if (result.Errors?.length) throw new Error('Storage deletion incomplete; please retry.');
  },
};
