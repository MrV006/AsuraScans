export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  melliCode?: string;
  workStatus?: 'available' | 'busy' | 'leave' | string;
  statusMessage?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
}

export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  title?: string;
  images: string[];
  publishAt?: any;
  isPending?: boolean;
  status?: 'public' | 'private' | 'needs_revision' | string;
  isPrivate?: boolean;
  revisionNote?: string;
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
