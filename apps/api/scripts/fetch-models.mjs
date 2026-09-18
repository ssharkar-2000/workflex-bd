/**
 * Downloads the face-api weights used by the verification pipeline.
 *
 * They are ~10 MB of binary and deliberately not committed. Until this runs,
 * the face stage reports SKIPPED and everything else still works — a fresh
 * clone is runnable without waiting on a download.
 *
 *   npm run models:fetch -w @workflex/api
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const BASE =
  'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

// ssdMobilenetv1 detects, faceLandmark68 aligns, faceRecognition produces the
// 128-float descriptor the selfie/NID comparison comes from.
const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

const target = resolve(process.env.FACE_MODELS_DIR ?? './models/face-api');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(target, { recursive: true });
  console.log(`Downloading face-api models to ${target}`);

  for (const file of FILES) {
    const destination = join(target, file);

    if (await exists(destination)) {
      console.log(`  skip  ${file} (already present)`);
      continue;
    }

    process.stdout.write(`  get   ${file} ... `);
    const response = await fetch(`${BASE}/${file}`);

    if (!response.ok) {
      console.log(`FAILED (HTTP ${response.status})`);
      process.exitCode = 1;
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    console.log(`ok (${(buffer.byteLength / 1_000_000).toFixed(1)} MB)`);
  }

  console.log('\nDone. Restart the API to load them.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
