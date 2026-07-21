export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  title?: string;
  images: string[];
  publishAt?: any;
  isPending?: boolean;
  submissions?: any[];
  contributors?: any;
  sortMode?: 'natural' | 'input';
  createdAt: any;
  updatedAt: any;
}

export interface Series {
  id: string;
  title: string;
  alternativeTitles: string[];
  cover: string;
  banner: string;
  author: string;
  artist: string;
  synopsis: string;
  genres: string[];
  tags: string[];
  isHero?: boolean;
  isFeatured?: boolean;
  slug?: string;
  status: string;
  rating: number;
  views?: number;
  type: string;
  chapters?: Chapter[];
  contributors?: any[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  createdAt: any;
  updatedAt: any;
}
