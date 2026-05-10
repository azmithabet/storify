import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from './env'

export const r2Client = config.R2_ACCOUNT_ID
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: config.R2_SECRET_ACCESS_KEY ?? '',
      },
    })
  : null

// Returns a presigned PUT URL + the final public URL (client uploads directly to R2)
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!r2Client || !config.R2_BUCKET_NAME) {
    throw new Error('R2 not configured')
  }
  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
  const publicUrl = `${config.R2_PUBLIC_URL}/${key}`
  return { uploadUrl, publicUrl }
}
