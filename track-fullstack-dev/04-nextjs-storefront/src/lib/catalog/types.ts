export type CategorySlug = 'audio' | 'home-office' | 'outdoor';

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  priceCents: number;
  /** Sponsored placements are paid for by an advertiser campaign (see the advertiser page). */
  sponsored: boolean;
  image: string;
}
