import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as tf from '@tensorflow/tfjs';
import type * as FaceApi from '@vladmandic/face-api';
import { decodeAndResize, type RawImage } from './image.util';
import type { Env } from '../config/env.schema';

export interface FaceDetectResult {
  available: boolean;
  facesDetected: number;
  descriptor: Float32Array | null;
  detector: string;
  notes: string[];
}

/**
 * Descriptor distance below this is the same person, above it is not.
 * 0.6 is the threshold face-api's own documentation uses; we treat the band
 * just above it as "a human should look" rather than an outright no.
 */
const MATCH_THRESHOLD = 0.6;
const REVIEW_THRESHOLD = 0.72;

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private runtime: Promise<typeof FaceApi | null> | null = null;
  private mediapipeReady: Promise<unknown | null> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private modelsDir(): string {
    return resolve(this.config.get('FACE_MODELS_DIR', { infer: true }));
  }

  /**
   * Loads face-api and its weights, once, on first use.
   *
   * Everything here is deliberately lazy and inside a try/catch. The package's
   * default Node entry pulls in @tensorflow/tfjs-node, a native module that
   * needs a toolchain to build — so this loads the WASM/pure-JS build instead,
   * and a failure degrades the face stage to SKIPPED rather than stopping the
   * API from starting. Identity verification is important; it is not worth
   * taking the whole service down for.
   */
  private load(): Promise<typeof FaceApi | null> {
    this.runtime ??= (async () => {
      const dir = this.modelsDir();

      if (!existsSync(dir)) {
        this.logger.warn(
          `Face models not found at ${dir} — face checks will be skipped. ` +
            `Run "npm run models:fetch -w @workflex/api" to install them.`,
        );
        return null;
      }

      try {
        // Pure-JS CPU backend: slower than WASM but has no binary to locate,
        // which matters for a check that runs a handful of times per signup.
        await tf.setBackend('cpu');
        await tf.ready();

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js') as typeof FaceApi;

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromDisk(dir),
          faceapi.nets.faceLandmark68Net.loadFromDisk(dir),
          faceapi.nets.faceRecognitionNet.loadFromDisk(dir),
        ]);

        this.logger.log(`face-api ready (backend: ${tf.getBackend()})`);
        return faceapi;
      } catch (err) {
        this.logger.warn(
          { err },
          'face-api could not be initialised — face checks will be skipped',
        );
        return null;
      }
    })();

    return this.runtime;
  }

  /**
   * MediaPipe's vision tasks are built for the browser — they expect canvas
   * and fetch semantics Node does not provide. It is wired here because it is
   * the better detector where it runs, selected with FACE_DETECTOR=mediapipe,
   * and falls back cleanly when initialisation fails.
   */
  private async loadMediapipe(): Promise<unknown | null> {
    this.mediapipeReady ??= (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const wasmRoot = resolve(
          process.cwd(),
          '../../node_modules/@mediapipe/tasks-vision/wasm',
        );
        const modelPath = resolve(
          this.modelsDir(),
          'blaze_face_short_range.tflite',
        );

        if (!existsSync(modelPath)) {
          this.logger.warn(
            'MediaPipe model file missing — using face-api detector',
          );
          return null;
        }

        const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot);
        return await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath },
          runningMode: 'IMAGE',
        });
      } catch (err) {
        this.logger.warn(
          { err },
          'MediaPipe unavailable in this runtime — using face-api detector',
        );
        return null;
      }
    })();

    return this.mediapipeReady;
  }

  /** face-api wants RGB; decoded images are RGBA. */
  private toTensor(image: RawImage): tf.Tensor3D {
    const pixels = new Uint8Array(image.width * image.height * 3);
    for (let i = 0, j = 0; i < image.data.length; i += 4, j += 3) {
      pixels[j] = image.data[i] ?? 0;
      pixels[j + 1] = image.data[i + 1] ?? 0;
      pixels[j + 2] = image.data[i + 2] ?? 0;
    }
    return tf.tensor3d(pixels, [image.height, image.width, 3]);
  }

  async detect(buffer: Buffer): Promise<FaceDetectResult> {
    const faceapi = await this.load();

    if (!faceapi) {
      return {
        available: false,
        facesDetected: 0,
        descriptor: null,
        detector: 'none',
        notes: ['Face models not installed'],
      };
    }

    const useMediapipe =
      this.config.get('FACE_DETECTOR', { infer: true }) === 'mediapipe';
    const mediapipe = useMediapipe ? await this.loadMediapipe() : null;

    const image = await decodeAndResize(buffer, 800);
    const tensor = this.toTensor(image);

    try {
      const notes: string[] = [];
      let facesDetected = 0;
      let detector = 'face-api/ssdMobilenetv1';

      if (mediapipe) {
        detector = 'mediapipe/blazeface';
        const detections = (
          mediapipe as {
            detect: (input: unknown) => { detections: unknown[] };
          }
        ).detect({
          data: image.data,
          width: image.width,
          height: image.height,
        });
        facesDetected = detections.detections.length;
      }

      // The descriptor always comes from face-api: it is what the comparison
      // step needs, and MediaPipe only returns boxes.
      const result = await faceapi
        .detectSingleFace(tensor as never)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!mediapipe) facesDetected = result ? 1 : 0;
      if (!result) notes.push('No face found in the image');

      return {
        available: true,
        facesDetected,
        descriptor: result?.descriptor ?? null,
        detector,
        notes,
      };
    } catch (err) {
      this.logger.warn({ err }, 'Face detection failed');
      return {
        available: false,
        facesDetected: 0,
        descriptor: null,
        detector: 'none',
        notes: ['Face detection failed'],
      };
    } finally {
      tensor.dispose();
    }
  }

  /** Euclidean distance between descriptors. Lower means more similar. */
  async compare(
    a: Float32Array,
    b: Float32Array,
  ): Promise<{ distance: number; verdict: 'match' | 'review' | 'mismatch' } | null> {
    const faceapi = await this.load();
    if (!faceapi) return null;

    const distance = faceapi.euclideanDistance(Array.from(a), Array.from(b));

    return {
      distance: Number(distance.toFixed(4)),
      verdict:
        distance <= MATCH_THRESHOLD
          ? 'match'
          : distance <= REVIEW_THRESHOLD
            ? 'review'
            : 'mismatch',
    };
  }
}
