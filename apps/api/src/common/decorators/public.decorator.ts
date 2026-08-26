import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * JwtAuthGuard is registered globally — auth is the default and endpoints
 * opt out explicitly. Forgetting a decorator then fails closed, which is the
 * safe direction for a product holding NID and payment data.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
