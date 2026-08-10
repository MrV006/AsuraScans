import React, { useState, useEffect } from "react";
import { Globe, Sparkles, Search, Check, AlertCircle, RefreshCw, Layers, BookOpen, ExternalLink, Copy } from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { Series, Chapter } from "../lib/types";

interface SeoTabProps {
  seriesList: Series[];
  fetchSeries: () => void;
  isSuperAdmin: boolean;
}

export default function SeoTab({ seriesList, fetchSeries, isSuperAdmin }: SeoTabProps) {
  // Global SEO States
  const [siteName, setSiteName] = useState("مانگاتا");
  const [siteTitle, setSiteTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [seoImage, setSeoImage] = useState("/logo.png");
  const [googleVerification, setGoogleVerification] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSuccess, setGlobalSuccess] = useState(false);

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

  // Fetch Global SEO Settings on mount
  useEffect(() => {
    async function loadGlobalSeo() {
      try {
        const settings = await apiClient.getSettings("seo");
        if (settings) {
          setSiteName(settings.siteName || "مانگاتا");
          setSiteTitle(settings.siteTitle || "");
          setMetaDescription(settings.metaDescription || "");
          setMetaKeywords(settings.metaKeywords || "");
          setSeoImage(settings.seoImage || "/logo.png");
          setGoogleVerification(settings.googleVerification || "");
        }
      } catch (err) {
        console.error("Failed to load global SEO settings:", err);
      }
    }
    loadGlobalSeo();
  }, []);

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

  // Save Global SEO Settings
  const handleSaveGlobalSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalLoading(true);
    setGlobalSuccess(false);

    try {
      await apiClient.saveSettings("seo", {
        siteName,
        siteTitle,
        metaDescription,
        metaKeywords,
        seoImage,
        googleVerification,
      });
      setGlobalSuccess(true);
      setTimeout(() => setGlobalSuccess(false), 3000);
    } catch (err: any) {
      alert("خطا در ذخیره تنظیمات عمومی: " + err.message);
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

  // Smart AI/Auto-Generator Logic for Series
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

  // Smart AI/Auto-Generator Logic for Chapter
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

  const siteOrigin = window.location.origin;

  return (
    <div className="space-y-10" dir="rtl">
      {/* Title Header */}
      <div className="border-b border-white/5 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Globe className="text-[var(--color-asura-accent)]" size={28} />
            سیستم سئو فوق پیشرفته و هوشمند گوگل
          </h2>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            مدیریت تگ‌های متا، نقشه سایت، کلمات کلیدی هدف نظیر <span className="text-[var(--color-asura-accent)] font-bold">مانهوا، مانگا، مانها، کمیک، کمیک بوک، انیمه</span> و پیکربندی سئو هوشمند خودکار وبسایت جهت کسب رتبه اول گوگل.
          </p>
        </div>
      </div>

      {/* Google Search Console & Sitemap Quick Access Bar */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-black/40 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-emerald-400 text-sm flex items-center gap-2">
            <Sparkles size={16} />
            لینک‌های ثبت در گوگل سرچ کنسول (Google Search Console)
          </h3>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-bold">خودکار و زنده</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">نقشه XML سایت (Sitemap)</span>
              <a href={`${siteOrigin}/sitemap.xml`} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 font-mono underline truncate block">
                {siteOrigin}/sitemap.xml
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(`${siteOrigin}/sitemap.xml`, 'sitemap')}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copiedLink === 'sitemap' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedLink === 'sitemap' ? 'کپی شد' : 'کپی'}
              </button>
              <a href={`${siteOrigin}/sitemap.xml`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg">
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">فایل دستورالعمل ربات‌ها (Robots.txt)</span>
              <a href={`${siteOrigin}/robots.txt`} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 font-mono underline truncate block">
                {siteOrigin}/robots.txt
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(`${siteOrigin}/robots.txt`, 'robots')}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copiedLink === 'robots' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedLink === 'robots' ? 'کپی شد' : 'کپی'}
              </button>
              <a href={`${siteOrigin}/robots.txt`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg">
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Global & Auto-SEO info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Global SEO Settings Form */}
        <div className="lg:col-span-7 bg-black/25 border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="font-black text-white text-base">تنظیمات سئو عمومی کل وبسایت</h3>
            <span className="text-[10px] bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent)] px-2.5 py-0.5 rounded-full font-bold">مخصوص مدیریت کل</span>
          </div>

          <form onSubmit={handleSaveGlobalSeo} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-xs font-bold mb-2">نام تجاری وبسایت</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="مانگاتا"
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-bold mb-2">عنوان سئو صفحه اصلی</label>
                <input
                  type="text"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="مانگاتا | پلتفرم هوشمند ترجمه و خوانش مانهوا و مانگا"
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold mb-2">توضیحات متای عمومی (Meta Description)</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                placeholder="توضیحات کوتاهی در مورد خدمات سایت، دانلود رایگان مانهوا، مانگا، انیمه با ترجمه فارسی برای موتورهای جستجو..."
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all resize-none leading-relaxed"
                required
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-zinc-500">طول بهینه بین ۱۲۰ تا ۱۶۰ کاراکتر است.</span>
                <span className={`text-[10px] font-mono ${metaDescription.length > 160 ? "text-amber-500" : "text-zinc-400"}`}>
                  {metaDescription.length} کاراکتر
                </span>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold mb-2">کلمات کلیدی اصلی سایت (Keywords)</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                placeholder="مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, مانگاتا"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all"
                required
              />
              <p className="text-[10px] text-zinc-500 mt-1">کلمات را با کاما انگلیسی (,) از هم جدا کنید.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-xs font-bold mb-2">تصویر پیش‌فرض اشتراک‌گذاری (SEO Image)</label>
                <input
                  type="text"
                  value={seoImage}
                  onChange={(e) => setSeoImage(e.target.value)}
                  placeholder="/logo.png"
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-bold mb-2">کد تایید Google Search Console</label>
                <input
                  type="text"
                  value={googleVerification}
                  onChange={(e) => setGoogleVerification(e.target.value)}
                  placeholder="google-site-verification code"
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={globalLoading}
              className="w-full bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent)]/90 disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
            >
              {globalLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : globalSuccess ? (
                <Check size={14} />
              ) : null}
              {globalSuccess ? "تغییرات با موفقیت ذخیره شدند" : "ذخیره تنظیمات عمومی سئو"}
            </button>
          </form>
        </div>

        {/* Informational Help Desk Card (Automation & Exact SEO) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-zinc-900/40 to-black/20 border border-white/5 rounded-2xl p-6 space-y-5">
          <h3 className="font-black text-amber-400 text-base flex items-center gap-2">
            <Sparkles size={18} />
            مکانیزم سئو اتوماتیک و هوشمند
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed text-justify">
            سایت شما به یک سیستم موتور رندرینگ متا کلاولر (Meta Crawler Rendering Engine) مجهز شده است. در هر ثانیه که خزنده گوگل وارد صفحات مانهواها و چپترها می‌شود، کدهای HTML مستقیماً روی سرور بازسازی شده و مشخصات زیر به طور کاملاً ارگانیک تزریق می‌گردند:
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex gap-3 items-start">
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
                <Check size={12} />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white block mb-0.5">سئو اتوماتیک چپترها بر اساس شماره و عنوان:</strong>
                هر چپتر جدیدی که آپلود می‌شود به طور خودکار عنوان، متاتگ، کلمات کلیدی و داده‌های اسکیما (Schema.org) دریافت می‌کند.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
                <Check size={12} />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white block mb-0.5">قابلیت ویرایش و تغییر توسط ادمین مربوطه:</strong>
                اگر ادمین خواست می‌تواند سئوی اختصاصی برای هر مانهوا یا چپتر وارد کند تا سئوی اتوماتیک اورراید (جایگزین) شود.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
                <Check size={12} />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white block mb-0.5">داده‌های ساختاریافته JSON-LD:</strong>
                ربات گوگل صفحات کارها را به عنوان ComicSeries و چپترها را به عنوان ComicIssue تشخیص می‌دهد و ستاره و مشخصات کامل آن را در نتایج گوگل قرار می‌دهد.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Series & Chapter Management Panel */}
      <div className="bg-black/25 border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="font-black text-white text-base">مدیریت سئو مانهواها و چپترها به صورت مجزا</h3>
            <p className="text-zinc-500 text-[10px] mt-1">امکان بهینه‌سازی و تنظیم متاتگ‌های سفارشی برای هر کار و چپترهای آن</p>
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
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-[var(--color-asura-accent)] rounded-xl pr-10 pl-4 py-2 text-xs text-white outline-none transition-all text-right"
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
                    <img src={s.cover} alt={s.title} className="w-10 h-14 object-cover rounded-lg bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <div className="font-sans font-bold text-xs text-white truncate">{s.title}</div>
                      <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
                        <span>نوع: {s.type === "Manga" ? "مانگا" : s.type === "Manhua" ? "مانها" : "مانهوا"}</span>
                        {hasCustomSeo && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold">سئو سفارشی</span>
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
                    <img src={selectedSeries.cover} alt={selectedSeries.title} className="w-12 h-16 object-cover rounded-xl border border-white/10" />
                    <div>
                      <h4 className="font-sans font-black text-sm text-white">{selectedSeries.title}</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">تولید خودکار متا تگ‌ها به همراه سئوی هوشمند چپترها</p>
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
                        تولید هوشمند سئوی اثر
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
                      {seriesSaving ? <RefreshCw size={12} className="animate-spin" /> : seriesSuccess ? <Check size={12} /> : null}
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
                              {chapterSaving ? <RefreshCw size={12} className="animate-spin" /> : chapterSuccess ? <Check size={12} /> : null}
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
