import type { ProductStatus } from '../lib/status';

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  status: ProductStatus;
  url: string;
  image: string;
};

export type Catalog = Map<string, CatalogProduct>;

let request: Promise<Catalog> | undefined;

/** Loads /catalog.json once per page: current names, prices and availability for the cart. */
export function loadCatalog(): Promise<Catalog> {
  request ??= fetch('/catalog.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
      return response.json() as Promise<{ products: CatalogProduct[] }>;
    })
    .then(({ products }) => new Map(products.map((product) => [product.id, product])))
    .catch((error: unknown) => {
      request = undefined; // allow a retry
      throw error;
    });
  return request;
}
