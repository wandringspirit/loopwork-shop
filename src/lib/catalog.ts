import { getCollection, type CollectionEntry } from 'astro:content';
import type { ProductStatus } from './status';
import { yarnColours, type YarnColour } from './yarn';

export type Product = CollectionEntry<'products'>;
export type Category = CollectionEntry<'categories'>;

const statusRank: Record<ProductStatus, number> = {
  available: 0,
  'made-to-order': 1,
  'sold-out': 2,
  hidden: 3,
};

/** Products shown in the shop. Sold-out pieces sink to the end, then `sortOrder`, then name. */
export async function getListedProducts(): Promise<Product[]> {
  const products = await getCollection('products', ({ data }) => data.status !== 'hidden');
  return products.sort(
    (a, b) =>
      statusRank[a.data.status] - statusRank[b.data.status] ||
      a.data.sortOrder - b.data.sortOrder ||
      a.data.name.localeCompare(b.data.name),
  );
}

export async function getCategories(): Promise<Category[]> {
  const categories = await getCollection('categories');
  return categories.sort((a, b) => a.data.order - b.data.order);
}

/** Looks up each category's colour: the one set for it, or the next colour in the palette. */
export function categoryColours(categories: Category[]) {
  const colours = new Map(
    categories.map((category, index) => [category.id, category.data.colour ?? yarnColours[index % yarnColours.length]]),
  );
  return (categoryId: string): YarnColour => colours.get(categoryId) ?? yarnColours[0];
}

export async function hasSampleProducts(): Promise<boolean> {
  const samples = await getCollection('products', ({ data }) => data.sample && data.status !== 'hidden');
  return samples.length > 0;
}

export const productUrl = (id: string) => `/shop/${id}/`;
