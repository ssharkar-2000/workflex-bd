import { Injectable, Logger } from '@nestjs/common';
import cv from '@techstark/opencv-js';
import { decodeAndResize } from './image.util';

export interface QualityResult {
  available: boolean;
  /** 0..1, higher is sharper. Blurred photos are the top rejection reason. */
  sharpness: number | null;
  /** 0..1, higher is worse — reflections washing out the card. */
  glare: number | null;
  /** Whether a card-shaped quadrilateral fills a plausible part of the frame. */
  cardFound: boolean | null;
  notes: string[];
}

/** Laplacian variance below this reads as blurred at our working resolution. */
const SHARPNESS_FLOOR = 0.18;
const GLARE_CEILING = 0.12;

/**
 * OpenCV image checks on an uploaded card.
 *
 * The point is fast feedback: telling someone their photo is blurred while
 * they still have the card in their hand is worth far more than a rejection
 * email a day later, and it keeps unreadable images out of the review queue.
 */
@Injectable()
export class ImageQualityService {
  private readonly logger = new Logger(ImageQualityService.name);
  private ready: Promise<boolean> | null = null;

  /** OpenCV.js compiles its WASM asynchronously; nothing may touch cv before that. */
  private init(): Promise<boolean> {
    this.ready ??= new Promise<boolean>((resolve) => {
      const runtime = cv as unknown as {
        getBuildInformation?: () => string;
        onRuntimeInitialized?: () => void;
      };

      if (typeof runtime.getBuildInformation === 'function') {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        this.logger.warn('OpenCV runtime did not initialise within 30s');
        resolve(false);
      }, 30_000);

      runtime.onRuntimeInitialized = () => {
        clearTimeout(timeout);
        this.logger.log('OpenCV runtime ready');
        resolve(true);
      };
    });

    return this.ready;
  }

  async analyse(buffer: Buffer): Promise<QualityResult> {
    const notes: string[] = [];

    if (!(await this.init())) {
      return {
        available: false,
        sharpness: null,
        glare: null,
        cardFound: null,
        notes: ['OpenCV unavailable'],
      };
    }

    const image = await decodeAndResize(buffer, 1024);

    let src: cv.Mat | null = null;
    let grey: cv.Mat | null = null;
    let laplacian: cv.Mat | null = null;
    let edges: cv.Mat | null = null;
    let contours: cv.MatVector | null = null;
    let hierarchy: cv.Mat | null = null;

    try {
      src = cv.matFromImageData({
        data: image.data,
        width: image.width,
        height: image.height,
      });

      grey = new cv.Mat();
      cv.cvtColor(src, grey, cv.COLOR_RGBA2GRAY);

      // --- sharpness: variance of the Laplacian, the standard blur metric ---
      laplacian = new cv.Mat();
      cv.Laplacian(grey, laplacian, cv.CV_64F);
      const mean = new cv.Mat();
      const stddev = new cv.Mat();
      cv.meanStdDev(laplacian, mean, stddev);
      const variance = Math.pow(stddev.doubleAt(0, 0), 2);
      mean.delete();
      stddev.delete();

      // Normalised against a value that reads as crisp on phone photos.
      const sharpness = Math.min(1, variance / 500);

      // --- glare: proportion of near-white pixels ---
      let bright = 0;
      const grayData = grey.data;
      for (let i = 0; i < grayData.length; i += 1) {
        if ((grayData[i] ?? 0) > 245) bright += 1;
      }
      const glare = grayData.length > 0 ? bright / grayData.length : 0;

      // --- card detection: a large four-sided contour ---
      edges = new cv.Mat();
      cv.Canny(grey, edges, 60, 180);
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      const frameArea = image.width * image.height;
      let cardFound = false;

      for (let i = 0; i < contours.size(); i += 1) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        // A card held to fill the frame occupies a wide but bounded slice of it.
        if (area > frameArea * 0.15 && area < frameArea * 0.98) {
          const approx = new cv.Mat();
          const perimeter = cv.arcLength(contour, true);
          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
          if (approx.rows === 4) cardFound = true;
          approx.delete();
        }
        contour.delete();
        if (cardFound) break;
      }

      if (sharpness < SHARPNESS_FLOOR) {
        notes.push('Image looks blurred — ask for a sharper photo');
      }
      if (glare > GLARE_CEILING) {
        notes.push('Strong glare — reflections may hide text');
      }
      if (!cardFound) {
        notes.push('No card-shaped outline detected');
      }

      return {
        available: true,
        sharpness: Number(sharpness.toFixed(3)),
        glare: Number(glare.toFixed(3)),
        cardFound,
        notes,
      };
    } finally {
      // OpenCV.js allocates outside the JS heap; every Mat must be released or
      // the WASM heap grows until the process dies.
      for (const mat of [src, grey, laplacian, edges, hierarchy]) mat?.delete();
      contours?.delete();
    }
  }
}
