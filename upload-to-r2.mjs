/**
 * Upload Édito A1 media files to Cloudflare R2
 *
 * Setup:
 * 1. Create R2 bucket at https://dash.cloudflare.com → R2 → Create bucket (name: edito-a1-media)
 * 2. Enable public access: bucket → Settings → Public access → Allow
 * 3. Create API token: My Profile → API Tokens → Create Token → R2 Token (Edit)
 * 4. Set env vars and run:
 *    R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET=edito-a1-media \
 *    EDITO_MEDIA_DIR="/path/to/Édito A1, 2e édition - 2022" node upload-to-r2.mjs
 *
 * After upload, set in Railway:
 *   NEXT_PUBLIC_MEDIA_BASE_URL=https://pub-XXXXX.r2.dev  (or your custom domain)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, extname } from 'path';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'edito-a1-media';

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error('Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

// Локальный корень медиафайлов Édito A1 (репозиторий публичный — личный путь не хардкодим):
//   EDITO_MEDIA_DIR="/path/to/Édito A1, 2e édition - 2022" node upload-to-r2.mjs
const DRIVE = process.env.EDITO_MEDIA_DIR;
if (!DRIVE) {
  console.error('Set EDITO_MEDIA_DIR to the local "Édito A1, 2e édition - 2022" media folder');
  process.exit(1);
}

const SOURCES = [
  { localDir: `${DRIVE}/Édito A1, 2e édition - 2022 Cahier Audio`, r2Prefix: 'cahier', ext: '.mp3' },
  { localDir: `${DRIVE}/Édito A1, 2e édition - 2022 Livre Audio`,  r2Prefix: 'livre',  ext: '.mp3' },
  { localDir: `${DRIVE}/Vidéos avec sous-titres`,                   r2Prefix: 'video/sub', ext: '.mp4' },
  { localDir: `${DRIVE}/Vidéos sans sous-titres`,                   r2Prefix: 'video/nosub', ext: '.mp4' },
];

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function upload(localPath, key, contentType) {
  const size = statSync(localPath).size;
  const mb = (size / 1024 / 1024).toFixed(1);
  process.stdout.write(`  Uploading ${key} (${mb} MB)... `);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: createReadStream(localPath),
    ContentType: contentType,
    ContentLength: size,
    CacheControl: 'public, max-age=31536000',
  }));

  console.log('✓');
}

async function main() {
  for (const { localDir, r2Prefix, ext } of SOURCES) {
    console.log(`\n📂 ${r2Prefix}`);
    let files;
    try {
      files = (await readdir(localDir)).filter(f => f.endsWith(ext));
    } catch {
      console.log(`  ⚠ Directory not found, skipping`);
      continue;
    }

    const contentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';

    for (const file of files) {
      const key = `${r2Prefix}/${file}`;
      if (await exists(key)) {
        console.log(`  ⏭ ${key} (already uploaded)`);
        continue;
      }
      await upload(join(localDir, file), key, contentType);
    }
  }

  console.log('\n✅ Done! Set in Railway: NEXT_PUBLIC_MEDIA_BASE_URL=https://pub-XXXXX.r2.dev');
}

main().catch(console.error);
