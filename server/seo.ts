import { dbManager } from "./db";

function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function generateSeoHtml(
  urlPath: string,
  templateHtml: string,
  requestHost: string,
  requestProtocol: string
): Promise<string> {
  const siteUrl = `${requestProtocol}://${requestHost}`;
  const canonicalUrl = `${siteUrl}${urlPath.split('?')[0]}`;

  // Default SEO Settings
  let globalSeo = {
    siteName: "مانگاتا",
    siteTitle: "مانگاتا | پلتفرم هوشمند ترجمه، مدیریت و خوانش مانهوا و مانگا",
    metaDescription: "مانگاتا (MANGATA) مرجع اصلی و زنده خواندن آنلاین و دانلود مانهوا، مانگا، مانها و کمیک با ترجمه اختصاصی، کیفیت HD و به روزرسانی روزانه.",
    metaKeywords: "مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, مانگاتا, خواندن مانهوا, ترجمه مانهوا, mangata",
    seoImage: "/logo.png",
    googleVerification: ""
  };

  // Attempt to load settings from DB
  try {
    const dbSeo = await dbManager.getSettings("seo");
    if (dbSeo) {
      globalSeo = { ...globalSeo, ...dbSeo };
    }
  } catch (e) {
    console.error("Error loading global SEO settings:", e);
  }

  let title = globalSeo.siteTitle;
  let description = globalSeo.metaDescription;
  let keywords = globalSeo.metaKeywords;
  let image = globalSeo.seoImage;
  let jsonLdData: any = null;
  let breadcrumbData: any = null;

  // Prefix relative image with absolute domain
  if (image && !image.startsWith("http")) {
    image = `${siteUrl}${image.startsWith("/") ? "" : "/"}${image}`;
  }

  // Route: Series Page (/series/:id)
  const seriesMatch = urlPath.match(/^\/series\/([^/]+)$/);
  // Route: Chapter Page (/series/:id/chapters\/([^/]+)$/
  const chapterMatch = urlPath.match(/^\/series\/([^/]+)\/chapters\/([^/]+)$/);

  if (chapterMatch) {
    const seriesId = chapterMatch[1];
    const chapterId = chapterMatch[2];

    try {
      const series = await dbManager.getSeriesById(seriesId);
      if (series) {
        const chapters = await dbManager.getChapters(seriesId);
        const chapter = chapters.find(c => c.id === chapterId || c.number.toString() === chapterId || c.id === `chapter-${chapterId}`);
        const comments = await dbManager.getCommentsForSeries(seriesId);

        const seriesTitle = series.title;
        const chapNum = chapter ? chapter.number : chapterId.replace('chapter-', '');
        const chapTitle = chapter?.title ? ` - ${chapter.title}` : "";
        const typeLabel = series.type === "Manga" ? "مانگا" : series.type === "Manhua" ? "مانها" : "مانهوا";

        // Check chapter custom overrides
        if (chapter?.seoTitle) {
          title = chapter.seoTitle;
        } else {
          title = `چپتر ${chapNum}${chapTitle} از ${typeLabel} ${seriesTitle} با ترجمه فارسی | ${globalSeo.siteName}`;
        }

        if (chapter?.seoDescription) {
          description = chapter.seoDescription;
        } else {
          let synopsisBrief = series.synopsis || "";
          if (synopsisBrief.length > 130) {
            synopsisBrief = synopsisBrief.slice(0, 130) + "...";
          }

          let commentsSnippet = "";
          if (comments && comments.length > 0) {
            commentsSnippet = " نظرات: " + comments.slice(0, 2).map(c => c.content).join(" | ");
            if (commentsSnippet.length > 100) {
              commentsSnippet = commentsSnippet.slice(0, 100) + "...";
            }
          }

          description = `مطالعه آنلاین و دانلود چپتر ${chapNum} ${typeLabel} ${seriesTitle}${chapTitle} با کیفیت عالی و ترجمه فارسی اختصاصی. ${synopsisBrief}${commentsSnippet} مرجع مانهوا و مانگا در ${globalSeo.siteName}.`;
        }

        if (chapter?.seoKeywords) {
          keywords = chapter.seoKeywords;
        } else {
          const seriesKeywords = Array.isArray(series.tags) ? series.tags.join(", ") : "";
          keywords = `چپتر ${chapNum} ${seriesTitle}, دانلود چپتر ${chapNum} ${seriesTitle}, خواندن آنلاین ${seriesTitle} چپتر ${chapNum}, ${seriesTitle} چپتر ${chapNum} فارسی, ${seriesKeywords}, مانهوا, مانگا, مانها, کمیک, ${globalSeo.siteName}`;
        }

        if (series.cover) {
          image = series.cover.startsWith("http") ? series.cover : `${siteUrl}${series.cover.startsWith("/") ? "" : "/"}${series.cover}`;
        }

        // Schema.org Chapter / ComicIssue JSON-LD
        jsonLdData = {
          "@context": "https://schema.org",
          "@type": "ComicIssue",
          "name": `چپتر ${chapNum}${chapTitle} - ${seriesTitle}`,
          "issueNumber": chapNum.toString(),
          "description": description,
          "image": image,
          "url": canonicalUrl,
          "isPartOf": {
            "@type": "ComicSeries",
            "name": seriesTitle,
            "url": `${siteUrl}/series/${series.id}`
          },
          "publisher": {
            "@type": "Organization",
            "name": globalSeo.siteName,
            "url": siteUrl
          }
        };

        breadcrumbData = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "خانه", "item": siteUrl },
            { "@type": "ListItem", "position": 2, "name": seriesTitle, "item": `${siteUrl}/series/${series.id}` },
            { "@type": "ListItem", "position": 3, "name": `چپتر ${chapNum}`, "item": canonicalUrl }
          ]
        };
      }
    } catch (e) {
      console.error("Error generating SEO for chapter page:", e);
    }
  } else if (seriesMatch) {
    const seriesId = seriesMatch[1];
    try {
      const series = await dbManager.getSeriesById(seriesId);
      if (series) {
        const comments = await dbManager.getCommentsForSeries(seriesId);
        const chapters = await dbManager.getChapters(seriesId);

        const seriesTitle = series.title;
        const altTitles = Array.isArray(series.alternativeTitles) && series.alternativeTitles.length > 0
          ? ` (${series.alternativeTitles.slice(0, 2).join(", ")})`
          : "";
        const typeLabel = series.type === "Manga" ? "مانگا" : series.type === "Manhua" ? "مانها" : "مانهوا";

        if (series.seoTitle) {
          title = series.seoTitle;
        } else {
          title = `${typeLabel} ${seriesTitle}${altTitles} با ترجمه فارسی | ${globalSeo.siteName}`;
        }

        if (series.seoDescription) {
          description = series.seoDescription;
        } else {
          let synopsisBrief = series.synopsis || "";
          if (synopsisBrief.length > 170) {
            synopsisBrief = synopsisBrief.slice(0, 170) + "...";
          }

          let commentsSnippet = "";
          if (comments && comments.length > 0) {
            commentsSnippet = " نظرات کاربران: " + comments.slice(0, 2).map(c => c.content).join(" | ");
            if (commentsSnippet.length > 100) {
              commentsSnippet = commentsSnippet.slice(0, 100) + "...";
            }
          }

          const authorArtist = (series.author || series.artist)
            ? ` اثر ${series.author || ""}${series.author && series.artist ? " / " : ""}${series.artist || ""}.`
            : "";

          description = `دانلود و خواندن آنلاین ${typeLabel} ${seriesTitle}${altTitles}.${authorArtist} خلاصه: ${synopsisBrief}${commentsSnippet} مرجع مانهوا و مانگا در ${globalSeo.siteName}.`;
        }

        if (series.seoKeywords) {
          keywords = series.seoKeywords;
        } else {
          const seriesKeywords = Array.isArray(series.tags) ? series.tags.join(", ") : "";
          const genresKeywords = Array.isArray(series.genres) ? series.genres.join(", ") : "";
          keywords = `${seriesTitle}, دانلود مانهوا ${seriesTitle}, خواندن آنلاین ${seriesTitle}, ${seriesTitle} فارسی, ${seriesKeywords}, ${genresKeywords}, مانهوا, مانگا, مانها, کمیک, انیمه, ${globalSeo.siteName}`;
        }

        if (series.cover) {
          image = series.cover.startsWith("http") ? series.cover : `${siteUrl}${series.cover.startsWith("/") ? "" : "/"}${series.cover}`;
        }

        // Schema.org ComicSeries JSON-LD
        jsonLdData = {
          "@context": "https://schema.org",
          "@type": "ComicSeries",
          "name": seriesTitle,
          "alternateName": series.alternativeTitles || [],
          "description": description,
          "image": image,
          "url": canonicalUrl,
          "genre": series.genres || [],
          "author": series.author ? { "@type": "Person", "name": series.author } : undefined,
          "publisher": {
            "@type": "Organization",
            "name": globalSeo.siteName,
            "url": siteUrl
          },
          "aggregateRating": series.rating ? {
            "@type": "AggregateRating",
            "ratingValue": series.rating.toString(),
            "bestRating": "5",
            "ratingCount": "50"
          } : undefined
        };

        breadcrumbData = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "خانه", "item": siteUrl },
            { "@type": "ListItem", "position": 2, "name": "لیست کارهای وبسایت", "item": `${siteUrl}/search` },
            { "@type": "ListItem", "position": 3, "name": seriesTitle, "item": canonicalUrl }
          ]
        };
      }
    } catch (e) {
      console.error("Error generating SEO for series page:", e);
    }
  } else {
    // General website Schema.org JSON-LD
    jsonLdData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": globalSeo.siteName,
      "url": siteUrl,
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
  }

  // Construct Google verification tag if present
  const googleVerificationHtml = globalSeo.googleVerification
    ? `<meta name="google-site-verification" content="${escapeHtml(globalSeo.googleVerification)}" />`
    : "";

  const jsonLdHtml = jsonLdData ? `<script type="application/ld+json">${JSON.stringify(jsonLdData)}</script>` : "";
  const breadcrumbHtml = breadcrumbData ? `<script type="application/ld+json">${JSON.stringify(breadcrumbData)}</script>` : "";

  // Head tags to inject
  const injectedSeoHead = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    ${googleVerificationHtml}
    ${jsonLdHtml}
    ${breadcrumbHtml}
  `;

  // Hidden crawler markup
  const injectedSeoBody = `
    <div id="seo-crawler-markup" style="display:none !important; visibility:hidden !important; opacity:0 !important; width:0 !important; height:0 !important; overflow:hidden !important; position:absolute !important; top:-9999px !important; left:-9999px !important; z-index:-99999 !important;" aria-hidden="true">
      <h1>${escapeHtml(title)}</h1>
      <h2>کلمات کلیدی: مانهوا ، مانگا ، مانها ، کمیک ، کمیک بوک ، انیمه</h2>
      <h3>وبسایت ${escapeHtml(globalSeo.siteName)}</h3>
      <p>توضیحات: ${escapeHtml(description)}</p>
      <p>برچسب‌ها: ${escapeHtml(keywords)}</p>
    </div>
  `;

  // 1. Remove existing title or meta tags from raw HTML template
  let html = templateHtml
    .replace(/<title>.*?<\/title>/gi, "")
    .replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, "")
    .replace(/<meta\s+name="keywords"\s+content=".*?"\s*\/?>/gi, "")
    .replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/gi, "");

  // 2. Inject into Head
  html = html.replace("</head>", `${injectedSeoHead}\n</head>`);

  // 3. Inject into Body
  if (html.includes("<body>")) {
    html = html.replace("<body>", `<body>\n${injectedSeoBody}`);
  } else if (html.includes("<body ")) {
    const bodyIndex = html.indexOf("<body");
    const closeBodyIndex = html.indexOf(">", bodyIndex);
    if (closeBodyIndex !== -1) {
      html = html.slice(0, closeBodyIndex + 1) + `\n${injectedSeoBody}` + html.slice(closeBodyIndex + 1);
    }
  }

  return html;
}
