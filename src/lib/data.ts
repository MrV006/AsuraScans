export interface Chapter {
  id: string;
  number: number;
  title?: string;
  date: string;
  views: string;
  images: string[];
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
  status: 'Ongoing' | 'Completed' | 'Hiatus';
  rating: number;
  type: 'Manhwa' | 'Manga' | 'Manhua';
  chapters: Chapter[];
}

export const mockSeries: Series[] = [
  {
    id: "return-of-the-disaster-class-hero",
    title: "Return of the Disaster-Class Hero",
    alternativeTitles: ["재앙급 영웅님이 귀환하셨다"],
    cover: "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "SAN.G",
    artist: "Lee Beom Geun",
    synopsis: "The greatest hero on Earth, who supposedly died saving the world, has returned after 20 years to exact his revenge on the betrayers who sent him to his death.",
    genres: ["Action", "Adventure", "Fantasy", "Revenge"],
    tags: ["Overpowered", "Betrayal", "Constellations"],
    status: "Ongoing",
    rating: 4.8,
    type: "Manhwa",
    chapters: Array.from({ length: 15 }, (_, i) => ({
      id: `ch-${15 - i}`,
      number: 15 - i,
      date: new Date(Date.now() - i * 86400000 * 7).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: [
        "https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&q=80&w=800&h=1200",
        "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?auto=format&fit=crop&q=80&w=800&h=1200",
      ]
    }))
  },
  {
    id: "solo-max-level-newbie",
    title: "Solo Max-Level Newbie",
    alternativeTitles: ["나 혼자 만렙 뉴비"],
    cover: "https://images.unsplash.com/photo-1542451542907-6cf80ff362d6?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "Wanz",
    artist: "Swing Bat",
    synopsis: "Jinhyuk, a gaming Nutuber, is the only person who saw the ending of the game [Tower of Trials]. However, when the game's popularity declines, it becomes a reality.",
    genres: ["Action", "Fantasy", "System"],
    tags: ["Towers", "Streamer", "Swordsman"],
    status: "Ongoing",
    rating: 4.6,
    type: "Manhwa",
    chapters: Array.from({ length: 10 }, (_, i) => ({
      id: `ch-${10 - i}`,
      number: 10 - i,
      date: new Date(Date.now() - i * 86400000 * 4).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: [
        "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800&h=1200"
      ]
    }))
  },
  {
    id: "swordmasters-youngest-son",
    title: "Swordmaster's Youngest Son",
    alternativeTitles: ["검술명가 막내아들"],
    cover: "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "Emperor Penguin",
    artist: "AZI",
    synopsis: "Jin Runcandel, the youngest son of the greatest swordmaster family... He was kicked out of his family and met a miserable end. But before he died, he was given a second chance.",
    genres: ["Action", "Fantasy", "Returner", "Magic"],
    tags: ["Time Travel", "Clan", "Genius"],
    status: "Ongoing",
    rating: 4.9,
    type: "Manhwa",
    chapters: Array.from({ length: 8 }, (_, i) => ({
      id: `ch-${84 - i}`,
      number: 84 - i,
      date: new Date(Date.now() - i * 86400000 * 5).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: [
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800&h=1200"
      ]
    }))
  },
  {
    id: "nano-machine",
    title: "Nano Machine",
    alternativeTitles: ["나노 마신"],
    cover: "https://images.unsplash.com/photo-1626284642220-410e30379b36?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "Han-Joong-Wue",
    artist: "GUGU",
    synopsis: "Cheon Yeo-Woon, an orphan from the Demonic Cult... He has his destiny changed when an unknown descendant from the future injects a nano machine into his body.",
    genres: ["Action", "Martial Arts", "Sci-Fi"],
    tags: ["Murim", "System", "Cultivation"],
    status: "Ongoing",
    rating: 4.9,
    type: "Manhwa",
    chapters: Array.from({ length: 5 }, (_, i) => ({
      id: `ch-${150 - i}`,
      number: 150 - i,
      date: new Date(Date.now() - i * 86400000 * 3).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: []
    }))
  },
  {
    id: "the-beginning-after-the-end",
    title: "The Beginning After The End",
    alternativeTitles: ["TBATE"],
    cover: "https://images.unsplash.com/photo-1542451313056-b7c8e626645f?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "TurtleMe",
    artist: "Fuyuki23",
    synopsis: "King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power.",
    genres: ["Action", "Adventure", "Fantasy", "Isekai"],
    tags: ["Reincarnation", "Magic", "Dragons"],
    status: "Ongoing",
    rating: 4.9,
    type: "Manhwa",
    chapters: Array.from({ length: 6 }, (_, i) => ({
      id: `ch-${175 - i}`,
      number: 175 - i,
      date: new Date(Date.now() - i * 86400000 * 10).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: []
    }))
  },
  {
    id: "doom-breaker",
    title: "Doom Breaker",
    alternativeTitles: ["Reincarnation of the Suicidal Battle God"],
    cover: "https://images.unsplash.com/photo-1601296200639-8edb34ee97fb?auto=format&fit=crop&q=80&w=400&h=600",
    banner: "https://images.unsplash.com/photo-1473654729523-203e25dfda10?auto=format&fit=crop&q=80&w=1600&h=400",
    author: "Cheong-Dam",
    artist: "Cheong-Dam",
    synopsis: "Zephyr is the last human fighting evil in a world abandoned by the gods. When he is killed in battle by Tartarus, the god of destruction, he gets a second chance.",
    genres: ["Action", "Fantasy", "Time Travel"],
    tags: ["Gods", "Demons", "Regress"],
    status: "Ongoing",
    rating: 4.8,
    type: "Manhwa",
    chapters: Array.from({ length: 4 }, (_, i) => ({
      id: `ch-${70 - i}`,
      number: 70 - i,
      date: new Date(Date.now() - i * 86400000 * 6).toLocaleDateString(),
      views: `${(Math.random() * 50 + 10).toFixed(1)}k`,
      images: []
    }))
  }
];
