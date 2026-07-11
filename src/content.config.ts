import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Shared frontmatter schema used by every content collection.
const postSchema = ({ image }: SchemaContext) =>
	z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.optional(image()),
	});

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: postSchema,
});

const english = defineCollection({
	// Load Markdown and MDX files in the `src/content/english/` directory.
	loader: glob({ base: './src/content/english', pattern: '**/*.{md,mdx}' }),
	// Reuse the same frontmatter schema as the blog.
	schema: postSchema,
});

const fsi = defineCollection({
	// Load Markdown and MDX files in the `src/content/fsi/` directory.
	loader: glob({ base: './src/content/fsi', pattern: '**/*.{md,mdx}' }),
	// Reuse the same frontmatter schema as the blog.
	schema: postSchema,
});

export const collections = { blog, english, fsi };
