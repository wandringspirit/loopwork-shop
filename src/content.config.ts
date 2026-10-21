import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { careSymbols } from './lib/care';
import { productStatuses } from './lib/status';
import { yarnColours } from './lib/yarn';

const categories = defineCollection({
  loader: file('src/content/categories.yaml'),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    order: z.number().default(100),
    /** Colour of the category's tile, labels and shop filter. Leave it out to use the next colour in the palette. */
    colour: z.enum(yarnColours).optional(),
    /** Product id whose first photo represents this category on the home page. */
    coverProduct: z.string().optional(),
  }),
});

const products = defineCollection({
  // One folder per product: src/content/products/<product-id>/index.md, with its photos beside it.
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/products',
    generateId: ({ entry }) => entry.split(/[\\/]/)[0],
  }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(2).max(60),
      summary: z.string().min(10).max(180),
      price: z.number().int().positive(),
      category: reference('categories'),
      status: z.enum(productStatuses),
      leadTime: z.string().optional(),
      options: z
        .array(z.object({ name: z.string(), values: z.array(z.string()).min(1) }))
        .default([]),
      photos: z
        .array(
          z.object({
            src: image(),
            alt: z.string().min(5),
            /** CSS object-position used when the photo is cropped, e.g. "50% 30%". */
            focus: z.string().optional(),
          }),
        )
        .min(1),
      size: z.string().optional(),
      materials: z.string(),
      care: z.string(),
      careSymbols: z.array(z.enum(careSymbols)).default([]),
      featured: z.boolean().default(false),
      sortOrder: z.number().default(100),
      /** Sample products use stock photos and must be replaced before launch. */
      sample: z.boolean().default(false),
    }),
});

const faq = defineCollection({
  loader: file('src/content/faq.yaml'),
  schema: z.object({
    group: z.enum(['Ordering', 'Payment', 'Shipping', 'Custom orders', 'Care', 'Returns']),
    question: z.string(),
    answer: z.string(),
    onHome: z.boolean().default(false),
  }),
});

const policies = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/policies' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { categories, products, faq, policies };
