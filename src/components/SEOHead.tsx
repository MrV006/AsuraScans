import React, { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  jsonLd?: any;
  siteName?: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  jsonLd,
  siteName = 'مانگاتا'
}) => {
  useEffect(() => {
    // 1. Update document title
    if (title) {
      document.title = title;
    }

    const setMetaTag = (selector: string, attrName: string, attrVal: string, contentVal: string) => {
      if (!contentVal) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentVal);
    };

    // 2. Standard Meta Tags
    if (description) {
      setMetaTag('meta[name="description"]', 'name', 'description', description);
    }
    if (keywords) {
      setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);
    }

    // 3. OpenGraph Meta Tags
    const currentUrl = url || window.location.href;
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title || document.title);
    if (description) setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    if (image) setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', type);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', siteName);

    // 4. Twitter Card Meta Tags
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title || document.title);
    if (description) setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (image) setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);

    // 5. Canonical Link
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', currentUrl.split('?')[0]);

    // 6. Schema.org JSON-LD
    let scriptEl = document.getElementById('jsonld-schema');
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'jsonld-schema';
        scriptEl.setAttribute('type', 'application/ld+json');
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, keywords, image, url, type, jsonLd, siteName]);

  return null;
};

export default SEOHead;
