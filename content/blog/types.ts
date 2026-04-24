import type { ComponentType } from "react";

export type ArticleMeta = {
  slug: string;
  title: string;
  /** Used for the <title>. Typically "<title copy> | UrbRank". */
  seoTitle: string;
  description: string;
  author: string;
  /** ISO date e.g. "2026-04-20" */
  published: string;
  /** Optional ISO update date */
  updated?: string;
  tags: string[];
  /** Approximate reading time in minutes. */
  readingMinutes: number;
  /** One-sentence summary used on listing cards. */
  summary: string;
};

export type Article = {
  meta: ArticleMeta;
  Body: ComponentType;
};
