import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';

export interface SiteSettings {
  maintenanceMode: boolean;
  maintenanceTitleFa?: string;
  maintenanceDescFa?: string;
  maintenanceTitleEn?: string;
  maintenanceDescEn?: string;
  aboutText: string;
  twitterUrl: string;
  discordUrl: string;
  githubUrl: string;
  telegramUrl: string;
  instagramUrl: string;
  seoKeywords: string;
  seoDescription: string;
  featuredType?: string;
  activeAnnouncement?: string;
  siteName?: string;
  footerCopyrightText: string;
  footerSubtext: string;
  termsOfService: string;
  privacyPolicy: string;
  logoUrl?: string;
  primaryColor?: string;
  hoverColor?: string;
  lightColor?: string;
  backgroundColor?: string;
  cardColor?: string;
  siteFont?: string;
}

const defaultSettings: SiteSettings = {
  maintenanceMode: false,
  maintenanceTitleFa: "سایت در حال بروزرسانی و ارتقا می‌باشد",
  maintenanceDescFa: "ما در حال ارتقای سرورها و افزودن امکانات جدید هستیم. لطفاً شکیبا باشید و به‌زودی دوباره سر بزنید.",
  maintenanceTitleEn: "Website Under Maintenance",
  maintenanceDescEn: "We are currently upgrading our platform to serve you better. Please check back soon.",
  aboutText: "به جدیدترین مرجع ترجمه مانهوا، مانهوا و مانگا با کیفیت بالا خوش آمدید. آپدیت روزانه.",
  twitterUrl: "#",
  discordUrl: "#",
  githubUrl: "#",
  telegramUrl: "#",
  instagramUrl: "#",
  seoKeywords: "manga, manhwa, manhua, webtoon, read comics, مانهوا, مانگا",
  seoDescription: "به جدیدترین مرجع ترجمه مانهوا، مانهوا و مانگا با کیفیت بالا خوش آمدید.",
  siteName: "Mangata",
  footerCopyrightText: "Mangata",
  footerSubtext: "MADE BY FANS FOR FANS",
  logoUrl: "",
  primaryColor: "#4f46e5",
  hoverColor: "#4338ca",
  lightColor: "#818cf8",
  backgroundColor: "#0a0a0c",
  cardColor: "#0f0f12",
  siteFont: "Inter",
  termsOfService: `# قوانین و مقررات سایت (Terms of Service)

به وبسایت آسوراسکنز خوش آمدید. با استفاده از خدمات ما، شما با شرایط زیر موافقت می‌کنید:

## ۱. مالکیت معنوی
تمامی آثار ترجمه شده و کارهای گرافیکی قرار گرفته بر روی وبسایت متعلق به تیم آسوراسکنز و مترجمان اثر می‌باشد. هرگونه کپی‌برداری تجاری بدون ذکر منبع ممنوع است.

## ۲. قوانین رفتاری کاربران
کاربران موظف هستند در بخش نظرات از ارسال محتوای توهین‌آمیز، اسپم یا لینک‌های تبلیغاتی خودداری نمایند. در غیر این صورت حساب کاربری آن‌ها مسدود خواهد شد.

## ۳. تغییرات در قوانین
ما حق تغییر شرایط و قوانین را در هر زمان برای خود محفوظ می‌داریم. ادامه استفاده شما از سایت به معنی پذیرش قوانین جدید است.`,
  privacyPolicy: `# حریم خصوصی کاربران (Privacy Policy)

تیم آسوراسکنز به حفظ حریم خصوصی کاربران خود اهمیت ویژه‌ای می‌دهد.

## ۱. اطلاعات جمع‌آوری شده
ما آدرس ایمیل و اطلاعات اولیه حساب کاربری شما را صرفاً جهت ارائه خدمات شخصی‌سازی شده (مانند نشانک‌ها، کیف پول و ثبت نظرات) نگهداری می‌کنیم.

## ۲. کوکی‌ها
سایت ما از کوکی‌های مرورگر برای ذخیره‌سازی نشست فعال شما استفاده می‌کند تا برای ورود مجدد نیاز به وارد کردن مجدد اطلاعات خود نداشته باشید.

## ۳. امنیت اطلاعات
ما تمام تلاش خود را برای محافظت از اطلاعات شخصی شما در برابر دسترسی‌های غیرمجاز انجام می‌دهیم و اطلاعات شما را تحت هیچ شرایطی به شخص ثالث واگذار نخواهیم کرد.`
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
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const cached = localStorage.getItem('asura_site_settings');
      if (cached) {
        return { ...defaultSettings, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.error("Failed to parse cached settings:", e);
    }
    return defaultSettings;
  });
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettingsAndTaxonomy = async () => {
    try {
      const globalSet = await apiClient.getSettings('global');
      if (globalSet) {
        setSettings({ ...defaultSettings, ...globalSet });
        try {
          localStorage.setItem('asura_site_settings', JSON.stringify(globalSet));
        } catch (e) {
          console.error("Failed to cache global settings:", e);
        }
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

  const customStyles = React.useMemo(() => {
    let css = "";
    
    if (settings.siteFont) {
      let importUrl = "";
      let fontName = settings.siteFont;
      
      switch(settings.siteFont) {
        case "Vazirmatn":
          importUrl = "/fonts/vazirmatn.css";
          fontName = "'Vazirmatn', sans-serif";
          break;
        case "Rubik":
          importUrl = "/fonts/rubik.css";
          fontName = "'Rubik', sans-serif";
          break;
        case "Lalezar":
          importUrl = "/fonts/lalezar.css";
          fontName = "'Lalezar', cursive";
          break;
        case "Inter":
          importUrl = "/fonts/inter.css";
          fontName = "'Inter', sans-serif";
          break;
        case "Outfit":
          importUrl = "/fonts/outfit.css";
          fontName = "'Outfit', sans-serif";
          break;
      }
      
      if (importUrl) {
        css += `@import url('${importUrl}');\n`;
      }
      
      css += `:root {\n  --font-sans: ${fontName} !important;\n  --font-display: ${fontName} !important;\n}\n`;
    }

    if (settings.primaryColor || settings.backgroundColor || settings.cardColor) {
      css += `:root {\n`;
      if (settings.primaryColor) {
        css += `  --color-asura-accent: ${settings.primaryColor} !important;\n`;
        css += `  --color-asura-accent-hover: ${settings.hoverColor || settings.primaryColor} !important;\n`;
        css += `  --color-asura-accent-light: ${settings.lightColor || settings.primaryColor} !important;\n`;
      }
      if (settings.backgroundColor) {
        css += `  --color-asura-dark: ${settings.backgroundColor} !important;\n`;
      }
      if (settings.cardColor) {
        css += `  --color-asura-card: ${settings.cardColor} !important;\n`;
      }
      css += `}\n`;
    }

    return css;
  }, [settings.siteFont, settings.primaryColor, settings.hoverColor, settings.lightColor, settings.backgroundColor, settings.cardColor]);

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
      {customStyles && <style dangerouslySetInnerHTML={{ __html: customStyles }} />}
      {children}
    </SettingsContext.Provider>
  );
}
