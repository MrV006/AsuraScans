import React, { useState, useEffect } from "react";
import { 
  Globe, 
  Sparkles, 
  Search, 
  Check, 
  RefreshCw, 
  Layers, 
  BookOpen, 
  ExternalLink, 
  Copy, 
  ShieldCheck, 
  Rss, 
  FileCode, 
  Smartphone, 
  Monitor, 
  HelpCircle,
  TrendingUp,
  Cpu
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { useSettings } from "../contexts/SettingsContext";
import { Series, Chapter } from "../lib/types";

interface SeoTabProps {
  seriesList: Series[];
  fetchSeries: () => void;
  isSuperAdmin: boolean;
}

export default function SeoTab({ seriesList, fetchSeries, isSuperAdmin }: SeoTabProps) {
  const { settings, updateSettings, reloadSettings } = useSettings();

  // Global SEO States
  const [siteName, setSiteName] = useState(settings.siteName || "مانگاتا");
  const [siteTitle, setSiteTitle] = useState(settings.siteTitle || "مانگاتا | Mangata - مرجع خواندن آنلاین مانگا و مانهوا");
  const [metaDescription, setMetaDescription] = useState(settings.metaDescription || settings.seoDescription || "");
  const [metaKeywords, setMetaKeywords] = useState(settings.metaKeywords || settings.seoKeywords || "");
  const [seoImage, setSeoImage] = useState(settings.seoImage || "/logo.png");
  const [googleVerification, setGoogleVerification] = useState(settings.googleVerification || "");
  const [bingVerification, setBingVerification] = useState(settings.bingVerification || "");
  const [yandexVerification, setYandexVerification] = useState(settings.yandexVerification || "");
  const [canonicalBaseUrl, setCanonicalBaseUrl] = useState(settings.canonicalBaseUrl || "");

  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSuccess, setGlobalSuccess] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Series SEO States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [activeTab, setActiveTab] = useState<'series' | 'chapters'>('series');

  // Custom Override States for the selected series
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customKeywords, setCustomKeywords] = useState("");
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesSuccess, setSeriesSuccess] = useState(false);

  // Chapters SEO States
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterSeoTitle, setChapterSeoTitle] = useState("");
  const [chapterSeoDescription, setChapterSeoDescription] = useState("");
  const [chapterSeoKeywords, setChapterSeoKeywords] = useState("");
  const [chapterSaving, setChapterSaving] = useState(false);
  const [chapterSuccess, setChapterSuccess] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Sync state with settings context when settings change
  useEffect(() => {
    if (settings) {
      if (settings.siteName) setSiteName(settings.siteName);
      if (settings.siteTitle) setSiteTitle(settings.siteTitle);
      if (settings.metaDescription || settings.seoDescription) {
        setMetaDescription(settings.metaDescription || settings.seoDescription || "");
      }
      if (settings.metaKeywords || settings.seoKeywords) {
        setMetaKeywords(settings.metaKeywords || settings.seoKeywords || "");
      }
      if (settings.seoImage) setSeoImage(settings.seoImage);
      if (settings.googleVerification) setGoogleVerification(settings.googleVerification);
      if (settings.bingVerification) setBingVerification(settings.bingVerification);
      if (settings.yandexVerification) setYandexVerification(settings.yandexVerification);
      if (settings.canonicalBaseUrl) setCanonicalBaseUrl(settings.canonicalBaseUrl);
    }
  }, [settings]);

  // Update override states when selected series changes
  useEffect(() => {
    if (selectedSeries) {
      setCustomTitle(selectedSeries.seoTitle || "");
      setCustomDescription(selectedSeries.seoDescription || "");
      setCustomKeywords(selectedSeries.seoKeywords || "");
      setSeriesSuccess(false);

      // Fetch chapters for this series
      setLoadingChapters(true);
      apiClient.getChapters(selectedSeries.id)
        .then((chs) => {
          const list = Array.isArray(chs) ? chs : [];
          setChaptersList(list);
          if (list.length > 0) {
            const firstCh = list[0];
            setSelectedChapter(firstCh);
            setChapterSeoTitle(firstCh.seoTitle || "");
            setChapterSeoDescription(firstCh.seoDescription || "");
            setChapterSeoKeywords(firstCh.seoKeywords || "");
          } else {
            setSelectedChapter(null);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingChapters(false));
    }
  }, [selectedSeries]);

  // Update chapter states when selected chapter changes
  useEffect(() => {
    if (selectedChapter) {
      setChapterSeoTitle(selectedChapter.seoTitle || "");
      setChapterSeoDescription(selectedChapter.seoDescription || "");
      setChapterSeoKeywords(selectedChapter.seoKeywords || "");
      setChapterSuccess(false);
    }
  }, [selectedChapter]);

  // Save Global SEO Settings (Persists to Context, DB & LocalStorage)
  const handleSaveGlobalSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalLoading(true);
    setGlobalSuccess(false);

    try {
      await updateSettings({
        siteName,
        siteTitle,
        metaDescription,
        seoDescription: metaDescription,
        metaKeywords,
        seoKeywords: metaKeywords,
        seoImage,
        googleVerification,
        bingVerification,
        yandexVerification,
        canonicalBaseUrl,
      });

      await reloadSettings();
      setGlobalSuccess(true);
      setTimeout(() => setGlobalSuccess(false), 3000);
    } catch (err: any) {
      alert("خطا در ذخیره پایدار تنظیمات سئو: " + (err.message || err));
    } finally {
      setGlobalLoading(false);
    }
  };

  // Save Series SEO Override
  const handleSaveSeriesSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries) return;
    setSeriesSaving(true);
    setSeriesSuccess(false);

    try {
      const updatedPayload = {
        ...selectedSeries,
        seoTitle: customTitle,
        seoDescription: customDescription,
        seoKeywords: customKeywords,
      };

      await apiClient.saveSeries(updatedPayload);
      setSeriesSuccess(true);
      fetchSeries();
      setTimeout(() => setSeriesSuccess(false), 3000);
    } catch (err: any) {
      alert("خطا در ذخیره سئو کار: " + err.message);
    } finally {
      setSeriesSaving(false);
    }
  };

  // Save Chapter SEO Override
  const handleSaveChapterSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries || !selectedChapter) return;
    setChapterSaving(true);
    setChapterSuccess(false);

    try {
      await apiClient.saveChapter(selectedSeries.id, {
        ...selectedChapter,
        seoTitle: chapterSeoTitle,
        seoDescription: chapterSeoDescription,
        seoKeywords: chapterSeoKeywords,
      });
      setChapterSuccess(true);
      setTimeout(() => setChapterSuccess(false), 3000);
    } catch (err: any) {
      alert("خطا در ذخیره سئو چپتر: " + err.message);
    } finally {
      setChapterSaving(false);
    }
  };

  // Smart Auto-Generator Logic for Series
  const handleAutoGenerateSeries = () => {
    if (!selectedSeries) return;

    const title = selectedSeries.title;
    const typeLabel = selectedSeries.type === "Manga" ? "مانگا" : selectedSeries.type === "Manhua" ? "مانها" : "مانهوا";
    
    const altTitlesPart = selectedSeries.alternativeTitles && selectedSeries.alternativeTitles.length > 0
      ? ` (${selectedSeries.alternativeTitles[0]})`
      : "";
    const generatedTitle = `${typeLabel} ${title}${altTitlesPart} با ترجمه فارسی اختصاصی | ${siteName}`;

    let synopsisBrief = selectedSeries.synopsis || "";
    if (synopsisBrief.length > 150) {
      synopsisBrief = synopsisBrief.slice(0, 150) + "...";
    }

    const tagsPart = selectedSeries.tags && selectedSeries.tags.length > 0
      ? ` تگ‌ها: ${selectedSeries.tags.slice(0, 4).join(", ")}.`
      : "";

    const authorArtistPart = (selectedSeries.author || selectedSeries.artist)
      ? ` اثری از ${selectedSeries.author || ""}${selectedSeries.author && selectedSeries.artist ? " / " : ""}${selectedSeries.artist || ""}.`
      : "";

    const generatedDesc = `خواندن آنلاین و دانلود ${typeLabel} ${title}${altTitlesPart}.${authorArtistPart} خلاصه داستان: ${synopsisBrief}${tagsPart} بهترین کیفیت و ترجمه فارسی در وبسایت ${siteName}. مانهوا، مانگا، مانها، کمیک، کمیک بوک، انیمه.`;

    const altTitlesStr = selectedSeries.alternativeTitles ? selectedSeries.alternativeTitles.join(", ") : "";
    const genresStr = selectedSeries.genres ? selectedSeries.genres.join(", ") : "";
    const tagsStr = selectedSeries.tags ? selectedSeries.tags.join(", ") : "";
    
    const generatedKeywords = [
      title,
      `دانلود ${typeLabel} ${title}`,
      `خواندن آنلاین ${title}`,
      `${title} با ترجمه فارسی`,
      altTitlesStr,
      genresStr,
      tagsStr,
      "مانهوا",
      "مانگا",
      "مانها",
      "کمیک",
      siteName
    ].filter(Boolean).join(", ");

    setCustomTitle(generatedTitle.slice(0, 70));
    setCustomDescription(generatedDesc.slice(0, 200));
    setCustomKeywords(generatedKeywords);
  };

  // Smart Auto-Generator Logic for Chapter
  const handleAutoGenerateChapter = () => {
    if (!selectedSeries || !selectedChapter) return;

    const title = selectedSeries.title;
    const chapNum = selectedChapter.number;
    const chapTitle = selectedChapter.title ? ` - ${selectedChapter.title}` : "";
    const typeLabel = selectedSeries.type === "Manga" ? "مانگا" : selectedSeries.type === "Manhua" ? "مانها" : "مانهوا";

    const generatedTitle = `چپتر ${chapNum}${chapTitle} از ${typeLabel} ${title} با ترجمه فارسی | ${siteName}`;

    let synopsisBrief = selectedSeries.synopsis || "";
    if (synopsisBrief.length > 120) {
      synopsisBrief = synopsisBrief.slice(0, 120) + "...";
    }

    const generatedDesc = `مطالعه آنلاین و دانلود چپتر ${chapNum} از ${typeLabel} ${title}${chapTitle} با کیفیت عالی HD و ترجمه اختصاصی. ${synopsisBrief} مطالعه کامل در رسانه ${siteName}.`;

    const generatedKeywords = [
      `چپتر ${chapNum} ${title}`,
      `دانلود چپتر ${chapNum} ${title}`,
      `خواندن آنلاین ${title} چپتر ${chapNum}`,
      `${title} چپتر ${chapNum} فارسی`,
      `مانهوا`,
      `مانگا`,
      siteName
    ].join(", ");

    setChapterSeoTitle(generatedTitle.slice(0, 70));
    setChapterSeoDescription(generatedDesc.slice(0, 200));
    setChapterSeoKeywords(generatedKeywords);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Filter series based on search
  const filteredSeries = seriesList.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.alternativeTitles && s.alternativeTitles.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://mangata.ir';

  return (
    <div className="space-y-8" dir="rtl">
      {/* Title Header */}
      <div className="border-b border-white/5 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[var(--color-asura-accent)]/15 border border-[var(--color-asura-accent)]/30 text-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/10">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                سیستم سئو فوق پیشرفته و ایندکس خودکار گوگل (Google SEO Suite)
              </h2>
              <p className="text-zinc-400 text-xs mt-1">
                معماری جامع سئو سرور-ساید، نقشه سایت چندسطحی (Sitemap Index) برای بیش از ۱۰,۰۰۰ اثر و چپتر، خوراک زنده RSS و اسکیماهای استاندارد Schema.org
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 BULK INDEXING ARCHITECTURE & GOOGLE SEARCH CONSOLE GUIDE */}
      <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-black/80 border border-emerald-500/20 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Cpu size={18} />
              </span>
              <h3 className="font-black text-white text-base">
                راهنمای ایندکس انبوه و خودکار گوگل (حل مشکل ۱۰,۰۰۰+ صفحه)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              شما <span className="text-emerald-400 font-bold">نیازی به ثبت دستی حتی یک صفحه هم در گوگل ندارید!</span> سیستم سایت به یک <strong className="text-white">Sitemap Index استاندارد بین‌المللی</strong> مجهز شده که با یک‌بار ثبت لینک زیر در گوگل سرچ کنسول، تمامی ۱۰,۰۰۰ کار و صدها هزار چپتر به صورت خودکار و دسته‌بندی‌شده شناسایی و ایندکس می‌شوند.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <ShieldCheck size={14} />
              استاندارد تأییدشده گوگل
            </span>
          </div>
        </div>

        {/* Sitemaps & RSS Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Master Sitemap Index */}
          <div className="bg-black/60 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 hover:border-emerald-400/60 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={13} />
                نقشه اصلی (Sitemap Index)
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded">مستر</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-snug">لینک مادر که باید در Google Search Console ثبت شود.</p>
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-xs font-mono text-zinc-200 truncate" dir="ltr">/sitemap.xml</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${siteOrigin}/sitemap.xml`, 'sitemap')}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  title="کپی لینک نقشه سایت"
                >
                  {copiedLink === 'sitemap' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <a
                  href={`${siteOrigin}/sitemap.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                  title="مشاهده زنده نقشه سایت"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* Series Sitemap */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                <Layers size={13} className="text-amber-400" />
                نقشه کارها و مانهواها
              </span>
              <span className="text-[9px] bg-white/5 text-zinc-400 font-mono px-1.5 py-0.5 rounded">Series</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-snug">شامل تمامی مانهواها و مانگاها همراه با تگ تصاویر گوگل.</p>
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-xs font-mono text-zinc-200 truncate" dir="ltr">/sitemap-series.xml</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${siteOrigin}/sitemap-series.xml`, 'sitemap-series')}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                >
                  {copiedLink === 'sitemap-series' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <a
                  href={`${siteOrigin}/sitemap-series.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-all"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* Chapters Sitemap */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                <BookOpen size={13} className="text-indigo-400" />
                نقشه تمامی چپترها
              </span>
              <span className="text-[9px] bg-white/5 text-zinc-400 font-mono px-1.5 py-0.5 rounded">Chapters</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-snug">ایندکس صاعقه‌ای و بهینه‌سازی شده برای ده‌ها هزار چپتر.</p>
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-xs font-mono text-zinc-200 truncate" dir="ltr">/sitemap-chapters.xml</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${siteOrigin}/sitemap-chapters.xml`, 'sitemap-chapters')}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                >
                  {copiedLink === 'sitemap-chapters' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <a
                  href={`${siteOrigin}/sitemap-chapters.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-all"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* RSS Live Feed */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                <Rss size={13} className="text-orange-400" />
                خوراک زنده RSS 2.0
              </span>
              <span className="text-[9px] bg-orange-500/20 text-orange-300 font-mono px-1.5 py-0.5 rounded">RSS Feed</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-snug">اطلاع‌رسانی لحظه‌ای آخرین چپترها و کارها به موتورهای جستجو.</p>
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-xs font-mono text-zinc-200 truncate" dir="ltr">/rss.xml</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${siteOrigin}/rss.xml`, 'rss')}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                >
                  {copiedLink === 'rss' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <a
                  href={`${siteOrigin}/rss.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-all"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Step by step instruction */}
        <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۱
            </div>
            <div className="text-xs leading-relaxed text-zinc-300">
              <strong className="text-white block">نحوه اتصال به سرچ کنسول گوگل:</strong>
              وارد Google Search Console شوید &larr; به بخش <strong>Sitemaps</strong> در منوی سمت چپ بروید &larr; آدرس <code className="text-emerald-400 font-mono bg-black/40 px-1.5 py-0.5 rounded">sitemap.xml</code> را وارد کرده و دکمه <strong>Submit</strong> را بزنید. گوگل ظرف چند ساعت تمام صفحات، کارها و چپترهای شما را به صورت خودکار پایش و ایندکس خواهد کرد.
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(`${siteOrigin}/sitemap.xml`, 'sitemap-copy-btn')}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            {copiedLink === 'sitemap-copy-btn' ? <Check size={14} /> : <Copy size={14} />}
            {copiedLink === 'sitemap-copy-btn' ? 'لینک مستر کپی شد' : 'کپی آدرس نقشه سایت'}
          </button>
        </div>
      </div>

      {/* Global & Auto-SEO info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Global SEO Settings Form */}
        <div className="lg:col-span-7 bg-black/35 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Globe size={18} className="text-[var(--color-asura-accent)]" />
                تنظیمات سئو عمومی کل وبسایت
              </h3>
              <p className="text-zinc-400 text-[11px] mt-0.5">تنظیمات این بخش به صورت پایدار در دیتابیس و کدهای HTML ذخیره می‌شود.</p>
            </div>
            <span className="text-[10px] bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent)] px-2.5 py-1 rounded-full font-bold border border-[var(--color-asura-accent)]/20">
              مدیریت کل
            </span>
          </div>

          <form onSubmit={handleSaveGlobalSeo} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-300 text-xs font-bold mb-2">نام تجاری وبسایت (Brand Name)</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="مانگاتا"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">نام سایت به عنوان پسوند در تمام تگ‌های سئو قرار می‌گیرد.</span>
              </div>
              <div>
                <label className="block text-zinc-300 text-xs font-bold mb-2">عنوان سئو صفحه اصلی (Site Title)</label>
                <input
                  type="text"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="مانگاتا | Mangata - مرجع خواندن آنلاین مانگا و مانهوا"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">عنوان اصلی که در تب مرورگر و نتایج گوگل نمایش داده می‌شود.</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-zinc-300 text-xs font-bold">توضیحات متای عمومی (Meta Description)</label>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${metaDescription.length > 160 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                  {metaDescription.length} / 160 کاراکتر
                </span>
              </div>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                placeholder="توضیحات کوتاهی در مورد خدمات سایت، دانلود رایگان مانهوا، مانگا، انیمه با ترجمه فارسی برای موتورهای جستجو..."
                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all resize-none leading-relaxed"
                required
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">طول بهینه توضیحات بین ۱۲۰ تا ۱۶۰ کاراکتر است.</span>
            </div>

            <div>
              <label className="block text-zinc-300 text-xs font-bold mb-2">کلمات کلیدی اصلی سایت (Keywords)</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                placeholder="مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, مانگاتا, خواندن مانهوا, ترجمه مانهوا, mangata"
                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                required
              />
              <p className="text-[10px] text-zinc-500 mt-1">کلمات را با کاما انگلیسی (,) از هم جدا کنید.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-300 text-xs font-bold mb-2">تصویر شاخص اشتراک‌گذاری (SEO Image)</label>
                <input
                  type="text"
                  value={seoImage}
                  onChange={(e) => setSeoImage(e.target.value)}
                  placeholder="/logo.png"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-300 text-xs font-bold mb-2">کد تایید Google Search Console</label>
                <input
                  type="text"
                  value={googleVerification}
                  onChange={(e) => setGoogleVerification(e.target.value)}
                  placeholder="google-site-verification code"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={globalLoading}
              className="w-full bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent)]/90 disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-asura-accent)]/20"
            >
              {globalLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : globalSuccess ? (
                <Check size={14} className="text-emerald-400" />
              ) : null}
              {globalSuccess ? "تنظیمات سئو با موفقیت در سرور و دیتابیس ذخیره شد" : "ذخیره و نهایی‌سازی تنظیمات عمومی سئو"}
            </button>
          </form>
        </div>

        {/* Real-Time Live Google SERP Simulator Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-zinc-900/60 to-black/40 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              پیش‌نمایش زنده در نتایج جستجوی گوگل
            </h3>
            <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === 'desktop' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-white'}`}
                title="نمایش دسکتاپ"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === 'mobile' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-white'}`}
                title="نمایش موبایل"
              >
                <Smartphone size={14} />
              </button>
            </div>
          </div>

          {/* Google Search Mockup Box */}
          <div className="bg-[#202124] border border-zinc-800 rounded-2xl p-4 space-y-2 text-right shadow-inner" dir="ltr">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold overflow-hidden">
                {seoImage ? <img src={seoImage} alt="logo" className="w-full h-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} /> : 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[13px] text-[#dadce0] font-sans block truncate font-medium">{siteName || "مانگاتا"}</span>
                <span className="text-[11px] text-[#bdc1c6] font-mono block truncate">{siteOrigin}</span>
              </div>
            </div>

            <h4 className="text-[18px] text-[#8ab4f8] hover:underline cursor-pointer font-sans leading-snug font-medium pt-1 line-clamp-2">
              {siteTitle || `${siteName} | مرجع خواندن آنلاین مانگا و مانهوا`}
            </h4>

            <p className="text-[13px] text-[#bdc1c6] font-sans leading-relaxed line-clamp-2">
              {metaDescription || "مرجع دانلود و خواندن آنلاین مانهوا، مانگا، مانها و کمیک با ترجمه فارسی و بالاترین کیفیت."}
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
              <span className="text-amber-400 font-bold">★ 4.9</span>
              <span>(۵۰۰+ رأی ثبت شده)</span>
              <span className="text-zinc-600">•</span>
              <span className="text-emerald-400">سایت ایمن و فعال (SSL)</span>
            </div>
          </div>

          {/* SEO Performance Features list */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                <Check size={12} />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white block">پشتیبانی کامل از تگ‌های OpenGraph & Twitter:</strong>
                پست‌ها و لینک‌ها هنگام اشتراک‌گذاری در تلگرام، واتساپ، بله، ایتا، دیسکورد و توییتر با پیش‌نمایش بزرگ و تصویر نشان داده می‌شوند.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                <Check size={12} />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white block">رندر سرور-ساید (SSR) متا تگ‌ها:</strong>
                خزنده‌های گوگل و بینگ قبل از اجرای جاوااسکریپت، عنوان، خلاصه و اطلاعات کامل کار را به صورت HTML خام دریافت می‌کنند.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Series & Chapter Management Panel */}
      <div className="bg-black/35 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="font-black text-white text-base">مدیریت سئو مانهواها و چپترها به صورت اختصاصی</h3>
            <p className="text-zinc-400 text-xs mt-1">تولید هوشمند متاتگ‌ها یا تنظیم عنوان و توضیحات دلخواه برای تک‌تک کارها و چپترها</p>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="جستجوی مانهوا بر اساس نام..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl pr-10 pl-4 py-2 text-xs text-white outline-none transition-all text-right"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Series Selection List */}
          <div className="xl:col-span-4 border border-white/5 rounded-xl max-h-[520px] overflow-y-auto divide-y divide-white/5 bg-zinc-900/10 custom-scrollbar">
            {filteredSeries.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">موردی یافت نشد.</div>
            ) : (
              filteredSeries.map((s) => {
                const isSelected = selectedSeries?.id === s.id;
                const hasCustomSeo = s.seoTitle || s.seoDescription || s.seoKeywords;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSeries(s)}
                    className={`w-full p-3.5 flex items-center gap-3.5 text-right transition-colors hover:bg-white/5 ${isSelected ? "bg-[var(--color-asura-accent)]/15 border-r-4 border-[var(--color-asura-accent)]" : ""}`}
                  >
                    <img src={s.cover} alt={s.title} className="w-10 h-14 object-cover rounded-lg bg-zinc-800 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-sans font-bold text-xs text-white truncate">{s.title}</div>
                      <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
                        <span>نوع: {s.type === "Manga" ? "مانگا" : s.type === "Manhua" ? "مانها" : "مانهوا"}</span>
                        {hasCustomSeo && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold">سئو اختصاصی</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Details Editor */}
          <div className="xl:col-span-8 bg-zinc-900/15 border border-white/5 rounded-xl p-5 md:p-6 min-h-[520px] flex flex-col justify-between">
            {selectedSeries ? (
              <div className="space-y-6">
                {/* Series Banner header & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-4">
                    <img src={selectedSeries.cover} alt={selectedSeries.title} className="w-12 h-16 object-cover rounded-xl border border-white/10 shrink-0" />
                    <div>
                      <h4 className="font-sans font-black text-sm text-white">{selectedSeries.title}</h4>
                      <p className="text-[10px] text-zinc-400 mt-1">شناسه یکتا: <code className="text-zinc-300 font-mono">{selectedSeries.id}</code></p>
                    </div>
                  </div>

                  <div className="flex items-center bg-black/40 border border-white/5 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('series')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'series' ? 'bg-[var(--color-asura-accent)] text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Layers size={13} />
                      سئوی کل اثر
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('chapters')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'chapters' ? 'bg-[var(--color-asura-accent)] text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <BookOpen size={13} />
                      سئوی تک‌تک چپترها ({chaptersList.length})
                    </button>
                  </div>
                </div>

                {/* TAB 1: SERIES SEO */}
                {activeTab === 'series' && (
                  <form onSubmit={handleSaveSeriesSeo} className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAutoGenerateSeries}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-black text-[10px] transition-colors shadow-lg shadow-amber-500/10"
                      >
                        <Sparkles size={11} />
                        تولید هوشمند و خودکار سئوی اثر
                      </button>
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-xs font-bold mb-1.5">عنوان سئو سفارشی (Title Override)</label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="عنوان سفارشی برای نتایج گوگل"
                        className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-xs font-bold mb-1.5">توضیحات متای سفارشی (Description Override)</label>
                      <textarea
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        rows={3}
                        placeholder="توضیحات سفارشی کوتاه جهت جلب توجه کاربر در نتایج جستجو"
                        className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all resize-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-xs font-bold mb-1.5">برچسب‌های کلمات کلیدی (Keywords Override)</label>
                      <input
                        type="text"
                        value={customKeywords}
                        onChange={(e) => setCustomKeywords(e.target.value)}
                        placeholder="برچسب‌های هدف این کار..."
                        className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    {/* Real-time Google SERP Preview Mockup */}
                    <div className="mt-4 border border-zinc-800/60 bg-black/40 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">پیش‌نمایش زنده در گوگل</span>
                      <div className="font-sans text-right" dir="ltr">
                        <div className="text-[11px] text-zinc-400 truncate mb-0.5">
                          {siteOrigin} &rsaquo; series &rsaquo; {selectedSeries.id}
                        </div>
                        <h5 className="text-[15px] text-[#8ab4f8] hover:underline cursor-pointer font-sans truncate font-medium">
                          {customTitle || `${selectedSeries.type === "Manga" ? "مانگا" : selectedSeries.type === "Manhua" ? "مانها" : "مانهوا"} ${selectedSeries.title} با ترجمه فارسی | ${siteName}`}
                        </h5>
                        <p className="text-[12px] text-zinc-400 font-sans leading-relaxed line-clamp-2">
                          {customDescription || `دانلود و خواندن آنلاین ${selectedSeries.type === "Manga" ? "مانگا" : selectedSeries.type === "Manhua" ? "مانها" : "مانهوا"} ${selectedSeries.title} با بهترین کیفیت و لینک مستقیم در وبسایت ${siteName}.`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={seriesSaving}
                      className="w-full mt-4 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent)]/90 disabled:opacity-50 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                    >
                      {seriesSaving ? <RefreshCw size={12} className="animate-spin" /> : seriesSuccess ? <Check size={12} className="text-emerald-400" /> : null}
                      {seriesSuccess ? "ذخیره موفقیت‌آمیز بود" : "ثبت و نهایی‌سازی سئو اثر"}
                    </button>
                  </form>
                )}

                {/* TAB 2: CHAPTERS SEO */}
                {activeTab === 'chapters' && (
                  <div className="space-y-4">
                    {loadingChapters ? (
                      <div className="py-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-[var(--color-asura-accent)]" />
                        در حال بارگذاری لیست چپترها...
                      </div>
                    ) : chaptersList.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500 text-xs bg-black/20 rounded-xl border border-white/5">
                        هیچ چپتری برای این مانهوا ثبت نشده است.
                      </div>
                    ) : (
                      <form onSubmit={handleSaveChapterSeo} className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                          <div className="flex-1">
                            <label className="block text-zinc-400 text-[11px] font-bold mb-1">انتخاب چپتر جهت سئو</label>
                            <select
                              value={selectedChapter?.id || ''}
                              onChange={(e) => {
                                const found = chaptersList.find(c => c.id === e.target.value);
                                setSelectedChapter(found || null);
                              }}
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            >
                              {chaptersList.map((ch) => (
                                <option key={ch.id} value={ch.id}>
                                  چپتر {ch.number} {ch.title ? `(${ch.title})` : ''} {ch.seoTitle ? '✔ [سئو دارد]' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleAutoGenerateChapter}
                            className="self-end sm:self-center flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-black text-[10px] transition-colors shrink-0 shadow-lg shadow-amber-500/10"
                          >
                            <Sparkles size={11} />
                            تولید هوشمند سئوی چپتر
                          </button>
                        </div>

                        {selectedChapter && (
                          <>
                            <div>
                              <label className="block text-zinc-400 text-xs font-bold mb-1.5">عنوان سئوی چپتر (Title Override)</label>
                              <input
                                type="text"
                                value={chapterSeoTitle}
                                onChange={(e) => setChapterSeoTitle(e.target.value)}
                                placeholder={`چپتر ${selectedChapter.number} از ${selectedSeries.title} با ترجمه فارسی | ${siteName}`}
                                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-zinc-400 text-xs font-bold mb-1.5">توضیحات متای چپتر (Description Override)</label>
                              <textarea
                                value={chapterSeoDescription}
                                onChange={(e) => setChapterSeoDescription(e.target.value)}
                                rows={3}
                                placeholder="توضیحات اختصاصی کوتاه برای این چپتر در گوگل..."
                                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all resize-none leading-relaxed"
                              />
                            </div>

                            <div>
                              <label className="block text-zinc-400 text-xs font-bold mb-1.5">کلمات کلیدی چپتر (Keywords Override)</label>
                              <input
                                type="text"
                                value={chapterSeoKeywords}
                                onChange={(e) => setChapterSeoKeywords(e.target.value)}
                                placeholder={`چپتر ${selectedChapter.number} ${selectedSeries.title}, دانلود چپتر ${selectedChapter.number}...`}
                                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={chapterSaving}
                              className="w-full mt-4 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent)]/90 disabled:opacity-50 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                            >
                              {chapterSaving ? <RefreshCw size={12} className="animate-spin" /> : chapterSuccess ? <Check size={12} className="text-emerald-400" /> : null}
                              {chapterSuccess ? "سئوی چپتر با موفقیت ثبت شد" : `ذخیره سئوی چپتر ${selectedChapter.number}`}
                            </button>
                          </>
                        )}
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-3">
                <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                  <Globe size={28} />
                </div>
                <div className="text-xs font-bold text-zinc-300">انتخاب مانهوا جهت بهینه‌سازی سئو</div>
                <p className="text-[10px] text-zinc-500 max-w-sm">از لیست سمت راست، یکی از مانهواها را انتخاب نمایید تا بتوانید متاتگ‌های اختصاصی اثر یا چپترهای آن را تغییر دهید یا به صورت هوشمند بسازید.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
