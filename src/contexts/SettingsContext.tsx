import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';

interface SiteSettings {
  maintenanceMode: boolean;
  aboutText: string;
  twitterUrl: string;
  discordUrl: string;
  githubUrl: string;
  seoKeywords: string;
  seoDescription: string;
  featuredType?: string;
  activeAnnouncement?: string;
  siteName?: string;
}

const defaultSettings: SiteSettings = {
  maintenanceMode: false,
  aboutText: "به جدیدترین مرجع ترجمه مانهوا، مانهوا و مانگا با کیفیت بالا خوش آمدید. آپدیت روزانه.",
  twitterUrl: "#",
  discordUrl: "#",
  githubUrl: "#",
  seoKeywords: "manga, manhwa, manhua, webtoon, read comics, مانهوا, مانگا",
  seoDescription: "به جدیدترین مرجع ترجمه مانهوا، مانهوا و مانگا با کیفیت بالا خوش آمدید.",
  siteName: "AsuraClone"
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

  const fetchSettingsAndTaxonomy = async () => {
    try {
      const globalSet = await apiClient.getSettings('global');
      if (globalSet) {
        setSettings({ ...defaultSettings, ...globalSet });
      }

      const taxSet = await apiClient.getSettings('taxonomy');
      if (taxSet && taxSet.genres) {
        setGenres(taxSet.genres);
      } else {
        setGenres([
          "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Magic", "Martial Arts", "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy"
        ]);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading settings via API Client:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndTaxonomy();

    const socket = getSocketInstance();
    socket.on("settings:updated", fetchSettingsAndTaxonomy);

    return () => {
      socket.off("settings:updated", fetchSettingsAndTaxonomy);
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, genres, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}
