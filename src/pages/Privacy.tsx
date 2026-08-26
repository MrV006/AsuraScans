import React from 'react';
import { Layout } from '../components/Layout';
import { useSettings } from '../contexts/SettingsContext';
import { Shield, ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';

export default function Privacy() {
  const { settings } = useSettings();

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return (
          <h3 key={index} className="text-lg font-black text-[var(--color-asura-accent-light)] mt-6 mb-3 font-sans">
            {trimmed.replace(/^###\s*/, '')}
          </h3>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h2 key={index} className="text-xl font-black text-white mt-8 mb-4 border-b border-white/10 pb-2 font-sans">
            {trimmed.replace(/^##\s*/, '')}
          </h2>
        );
      }
      if (trimmed.startsWith('#')) {
        return (
          <h1 key={index} className="text-2xl font-black text-[var(--color-asura-accent)] mt-10 mb-6 font-sans">
            {trimmed.replace(/^#\s*/, '')}
          </h1>
        );
      }
      if (trimmed === '') {
        return <div key={index} className="h-4" />;
      }
      return (
        <p key={index} className="text-zinc-300 text-sm leading-relaxed mb-3 font-medium">
          {line}
        </p>
      );
    });
  };

  return (
    <Layout>
      <SEOHead 
        title={`حریم خصوصی کاربران | ${settings?.siteName || 'مانگاتا'}`}
        description={`سیاست‌ها و قوانین حفظ حریم خصوصی و امنیت اطلاعات کاربران در رسانه ${settings?.siteName || 'مانگاتا'}.`}
        keywords={`حریم خصوصی, قوانین سایت, امنیت کاربران, ${settings?.siteName || 'مانگاتا'}`}
        siteName={settings?.siteName || 'مانگاتا'}
      />
      <div className="min-h-[80vh] bg-[#0b0b0e] py-12 px-4 md:px-8" dir="rtl">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8 font-bold">
            <Link to="/" className="hover:text-white transition-colors">خانه</Link>
            <ChevronRight size={12} className="rotate-180" />
            <span className="text-[var(--color-asura-accent)]">حریم خصوصی</span>
          </div>

          <div className="relative bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-3xl p-6 md:p-10 shadow-2xl overflow-hidden">
            {/* Ambient Background Lights */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-asura-accent)]/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -z-10"></div>

            {/* Header */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-asura-accent)]/10 flex items-center justify-center text-[var(--color-asura-accent)]">
                <Shield size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white font-sans">حریم خصوصی کاربران</h1>
                <p className="text-xs text-zinc-500 mt-1 font-medium">آخرین بروزرسانی: تیر ۱۴۰۵</p>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-invert max-w-none text-right">
              {renderFormattedText(settings.privacyPolicy || '')}
            </div>

            {/* Back Button */}
            <div className="mt-12 pt-6 border-t border-white/5 flex justify-end">
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-black text-xs px-5 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
              >
                بازگشت به خانه
                <ArrowLeft size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
