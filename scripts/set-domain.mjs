// Moves the site to a new domain: `npm run set-domain -- studreads.app`
// Rewrites the address in the app, index.html and the SEO files in public/.
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = ['src/content/site.js', 'index.html', 'public/llms.txt', 'public/robots.txt', 'public/sitemap.xml', 'public/privacy.html', 'public/manifest.webmanifest', 'README.md'];

const next = (process.argv[2] || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) {
  console.error('Usage: npm run set-domain -- example.com');
  process.exit(1);
}

const current = readFileSync('src/content/site.js', 'utf8').match(/host: '([^']+)'/)[1];
FILES.forEach((file) => {
  const text = readFileSync(file, 'utf8');
  if (text.includes(current)) writeFileSync(file, text.replaceAll(current, next));
});
console.log(`${current} → ${next}`);
