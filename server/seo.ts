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

  // Default SEO Settings
  let globalSeo = {
    siteName: "مانگاتا",
    siteTitle: "مانگاتا | پلتفرم هوشمند ترجمه، مدیریت و خوانش مانهوا",
    metaDescription: "مانگاتا (MANGATA) قدرتمندترین پورتال اختصاصی و زنده مانهوا، مانگا، مانها، کمیک، کمیک بوک و انیمه. استخدام در تیم ترجمه و طراحی مانگاتا...",
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

  // Prefix relative image with absolute domain
  if (image && !image.startsWith("http")) {
    image = `${siteUrl}${image.startsWith("/") ? "" : "/"}${image}`;
  }

  // Route: Series Page (/series/:id)
  const seriesMatch = urlPath.match(/^\/series\/([^/]+)$/);
  // Route: Chapter Page (/series/:id/chapters/:chapterId)
  const chapterMatch = urlPath.match(/^\/series\/([^/]+)\/chapters\/([^/]+)$/);

  if (chapterMatch) {
    const seriesId = chapterMatch[1];
    const chapterId = chapterMatch[2];

    try {
      const series = await dbManager.getSeriesById(seriesId);
      if (series) {
        const chapters = await dbManager.getChapters(seriesId);
        const chapter = chapters.find(c => c.id === chapterId);
        const comments = await dbManager.getCommentsForSeries(seriesId);

        const seriesTitle = series.title;
        const chapNum = chapter ? chapter.number : "?";
        const chapTitle = chapter?.title ? ` - ${chapter.title}` : "";
        const typeLabel = series.type === "Manga" ? "مانگا" : series.type === "Manhua" ? "مانها" : "مانهوا";

        title = `چپتر ${chapNum}${chapTitle} از ${typeLabel} ${seriesTitle} با ترجمه فارسی | ${globalSeo.siteName}`;
        
        // Dynamic description from synopsis and comments
        let synopsisBrief = series.synopsis || "";
        if (synopsisBrief.length > 150) {
          synopsisBrief = synopsisBrief.slice(0, 150) + "...";
        }

        let commentsSnippet = "";
        if (comments && comments.length > 0) {
          commentsSnippet = " نظرات کاربران: " + comments.slice(0, 3).map(c => c.content).join(" | ");
          if (commentsSnippet.length > 150) {
            commentsSnippet = commentsSnippet.slice(0, 150) + "...";
          }
        }

        description = `خوانش آنلاین و دانلود چپتر ${chapNum} ${typeLabel} ${seriesTitle} با ترجمه فارسی اختصاصی و بالاترین کیفیت.${commentsSnippet ? commentsSnippet : " " + synopsisBrief} مرجع دانلود مانهوا، مانگا، مانها، کمیک بوک و انیمه در ${globalSeo.siteName}.`;
        
        const seriesKeywords = Array.isArray(series.tags) ? series.tags.join(", ") : "";
        keywords = `چپتر ${chapNum} ${seriesTitle}, دانلود چپتر ${chapNum} ${seriesTitle}, خواندن آنلاین ${seriesTitle} چپتر ${chapNum}, ${seriesTitle} چپتر ${chapNum} فارسی, ${seriesKeywords}, مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, ${globalSeo.siteName}`;
        
        if (series.cover) {
          image = series.cover.startsWith("http") ? series.cover : `${siteUrl}${series.cover.startsWith("/") ? "" : "/"}${series.cover}`;
        }
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

        const seriesTitle = series.title;
        const altTitles = Array.isArray(series.alternativeTitles) && series.alternativeTitles.length > 0
          ? ` (نام های دیگر: ${series.alternativeTitles.join(", ")})`
          : "";
        const typeLabel = series.type === "Manga" ? "مانگا" : series.type === "Manhua" ? "مانها" : "مانهوا";

        if (series.seoTitle) {
          title = series.seoTitle;
        } else {
          title = `${typeLabel} ${seriesTitle}${altTitles ? " - " + series.title : ""} با ترجمه فارسی | ${globalSeo.siteName}`;
        }

        if (series.seoDescription) {
          description = series.seoDescription;
        } else {
          let synopsisBrief = series.synopsis || "";
          if (synopsisBrief.length > 180) {
            synopsisBrief = synopsisBrief.slice(0, 180) + "...";
          }

          let commentsSnippet = "";
          if (comments && comments.length > 0) {
            commentsSnippet = " نظرات و نقدها: " + comments.slice(0, 3).map(c => c.content).join(" | ");
            if (commentsSnippet.length > 120) {
              commentsSnippet = commentsSnippet.slice(0, 120) + "...";
            }
          }

          const authorArtist = (series.author || series.artist)
            ? ` اثری از ${series.author || ""}${series.author && series.artist ? " و " : ""}${series.artist || ""}.`
            : "";

          description = `دانلود و خواندن آنلاین ${typeLabel} ${seriesTitle}${altTitles}.${authorArtist} خلاصه داستان: ${synopsisBrief}${commentsSnippet} مرجع مانهوا، مانگا، مانها، کمیک بوک و انیمه در ${globalSeo.siteName}.`;
        }

        if (series.seoKeywords) {
          keywords = series.seoKeywords;
        } else {
          const seriesKeywords = Array.isArray(series.tags) ? series.tags.join(", ") : "";
          const genresKeywords = Array.isArray(series.genres) ? series.genres.join(", ") : "";
          keywords = `${seriesTitle}, دانلود مانهوا ${seriesTitle}, خواندن آنلاین ${seriesTitle}, ${seriesTitle} فارسی, ${seriesKeywords}, ${genresKeywords}, مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, ${globalSeo.siteName}`;
        }

        if (series.cover) {
          image = series.cover.startsWith("http") ? series.cover : `${siteUrl}${series.cover.startsWith("/") ? "" : "/"}${series.cover}`;
        }
      }
    } catch (e) {
      console.error("Error generating SEO for series page:", e);
    }
  }

  // Construct Google verification tag if present
  const googleVerificationHtml = globalSeo.googleVerification
    ? `<meta name="google-site-verification" content="${escapeHtml(globalSeo.googleVerification)}" />`
    : "";

  // Head tags we want to inject
  const injectedSeoHead = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(siteUrl + urlPath)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    ${googleVerificationHtml}
  `;

  // Visual hidden div for maximum crawler indexation (exact keywords)
  const injectedSeoBody = `
    <div id="seo-crawler-markup" style="display:none !important; visibility:hidden !important; opacity:0 !important; width:0 !important; height:0 !important; overflow:hidden !important; position:absolute !important; top:-9999px !important; left:-9999px !important; z-index:-99999 !important;" aria-hidden="true">
      <h1>${escapeHtml(title)}</h1>
      <h2>کلمات کلیدی: مانهوا ، مانگا ، مانها ، کمیک ، کمیک بوک ، انیمه</h2>
      <h3>وبسایت ${escapeHtml(globalSeo.siteName)}</h3>
      <p>توضیحات: ${escapeHtml(description)}</p>
      <p>برچسب‌ها: ${escapeHtml(keywords)}</p>
      <p>امکانات: ترجمه هوشمند مانهوا، دانلود رایگان مانگا، استخدام مترجم مانگا، تالار گفتگوی کمیک</p>
    </div>
  `;

  // 1. Remove any existing title or meta descriptions in template
  let html = templateHtml
    .replace(/<title>.*?<\/title>/gi, "")
    .replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, "")
    .replace(/<meta\s+name="keywords"\s+content=".*?"\s*\/?>/gi, "");

  // 2. Inject into Head
  html = html.replace("</head>", `${injectedSeoHead}\n</head>`);

  // 3. Inject into Body
  if (html.includes("<body>")) {
    html = html.replace("<body>", `<body>\n${injectedSeoBody}`);
  } else if (html.includes("<body ")) {
    // case where body has attributes
    const bodyIndex = html.indexOf("<body");
    const closeBodyIndex = html.indexOf(">", bodyIndex);
    if (closeBodyIndex !== -1) {
      html = html.slice(0, closeBodyIndex + 1) + `\n${injectedSeoBody}` + html.slice(closeBodyIndex + 1);
    }
  }

  return html;
}
