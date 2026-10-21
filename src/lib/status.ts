export const productStatuses = ['available', 'made-to-order', 'sold-out', 'hidden'] as const;

export type ProductStatus = (typeof productStatuses)[number];

export const statusLabels: Record<ProductStatus, string> = {
  available: 'Ready to ship',
  'made-to-order': 'Made to order',
  'sold-out': 'Sold out',
  hidden: 'Not listed',
};

export const isOrderable = (status: ProductStatus) => status === 'available' || status === 'made-to-order';
