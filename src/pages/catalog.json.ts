import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { getCollection } from 'astro:content';
import { productUrl } from '../lib/catalog';

/**
 * Product data the cart reads in the browser: names, prices, availability and a thumbnail.
 * Built with the site, so it always matches the products that are deployed.
 */
export const GET: APIRoute = async () => {
  const products = await getCollection('products');
  const items = await Promise.all(
    products.map(async ({ id, data }) => {
      const thumbnail = await getImage({ src: data.photos[0].src, width: 180, height: 225, fit: 'cover', format: 'webp' });
      return { id, name: data.name, price: data.price, status: data.status, url: productUrl(id), image: thumbnail.src };
    }),
  );

  return new Response(JSON.stringify({ products: items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
