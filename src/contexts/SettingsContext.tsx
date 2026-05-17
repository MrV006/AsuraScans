import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SiteSettings {
  maintenanceMode: boolean;
  aboutText: string;
  twitterUrl: string;
  discordUrl: string;
  githubUrl: string;
  seoKeywords: string;
  seoDescription: string;
}

const defaultSettings: SiteSettings = {
  maintenanceMode: false,
  aboutText: "Read the latest top-tier manhwa, manhua, and manga with high-quality translations. Updated daily.",
  twitterUrl: "#",
  discordUrl: "#",
  githubUrl: "#",
  seoKeywords: "manga, manhwa, manhua, webtoon, read comics",
  seoDescription: "Read the latest top-tier manhwa, manhua, and manga with high-quality translations."
};

interface SettingsContextType {
  settings: SiteSettings;
  genres: string[];
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({ settings: defaultSettings, genres: [], loading: true });

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      }
    });

    const unsubTaxonomy = onSnapshot(doc(db, "settings", "taxonomy"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().genres) {
        setGenres(docSnap.data().genres);
      } else {
        setGenres([
          "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Magic", "Martial Arts", "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy"
        ]);
      }
      setLoading(false);
    });

    return () => {
      unsubSettings();
      unsubTaxonomy();
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, genres, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}
