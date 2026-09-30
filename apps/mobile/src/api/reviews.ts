import {
  ratingsPageSchema,
  reviewSchema,
  type CreateReviewInput,
  type RatingsPage,
  type Review,
  type ReviewRole,
} from '@workflex/shared';
import { api } from './client';

/** Ratings, reviews received and reviews given, for one role. */
export async function fetchRatings(role: ReviewRole): Promise<RatingsPage> {
  const { data } = await api.get('/reviews/me', { params: { role } });
  return ratingsPageSchema.parse(data);
}

/** Review someone you shared a job with. */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  const { data } = await api.post('/reviews', input);
  return reviewSchema.parse(data);
}
