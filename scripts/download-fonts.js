import fs from 'fs';
import path from 'path';

const FONTS_CONFIG = [
  {
    name: 'Inter',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
  },
  {
    name: 'Outfit',
    url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
  },
  {
    name: 'Vazirmatn',
    url: 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap'
  },
  {
    name: 'Rubik',
    url: 'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap'
  },
  {
    name: 'Lalezar',
    url: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap'
  }
];

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

// Chrome User-Agent is needed to get modern .woff2 formats
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(destPath, buffer);
}

async function run() {
  console.log('Starting local font downloader...');
  
  // Ensure target dir exists
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    console.log(`Created directory: ${FONTS_DIR}`);
  }

  let indexCssImports = '';

  for (const font of FONTS_CONFIG) {
    console.log(`\n--- Fetching CSS for ${font.name} ---`);
    try {
      const res = await fetch(font.url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch font CSS for ${font.name}: ${res.statusText}`);
      }

      let cssContent = await res.text();
      
      // Find all gstatic urls
      const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/g;
      const urls = [];
      let match;
      while ((match = urlRegex.exec(cssContent)) !== null) {
        urls.push(match[1]);
      }

      console.log(`Found ${urls.length} font file references for ${font.name}. Downloading...`);

      // Download all font files and replace URLs in CSS
      const uniqueUrls = [...new Set(urls)];
      for (const url of uniqueUrls) {
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const fontFilePath = path.join(FONTS_DIR, fileName);

        if (!fs.existsSync(fontFilePath)) {
          console.log(`Downloading: ${fileName}`);
          await downloadFile(url, fontFilePath);
        } else {
          console.log(`Skipping (already exists): ${fileName}`);
        }

        // Replace gstatic URL with local absolute/relative URL
        // In the build and client site, serving from '/fonts/[filename]' works perfectly
        const relativeUrl = `/fonts/${fileName}`;
        cssContent = cssContent.split(url).join(relativeUrl);
      }

      // Write font-specific CSS file
      const fontCssPath = path.join(FONTS_DIR, `${font.name.toLowerCase()}.css`);
      await fs.promises.writeFile(fontCssPath, cssContent, 'utf-8');
      console.log(`Saved CSS to ${fontCssPath}`);
      
    } catch (error) {
      console.error(`Error processing font ${font.name}:`, error);
    }
  }

  console.log('\nAll fonts downloaded and CSS files generated in /public/fonts/');
}

run();
