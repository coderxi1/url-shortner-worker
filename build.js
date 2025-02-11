import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const importRaw = async (p) => new String(await fs.promises.readFile(path.join(__dirname, "./" + p)));
import { minify as htmlminifierMinify } from 'html-minifier';
import { minify_sync as terserMinify } from 'terser';

const minifyHtml = (html) =>
  htmlminifierMinify(html, {
    removeAttributeQuotes: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    removeComments: true,
  }).replace(
    /<script>(.*?)<\/script>/gs,
    (_match, jsCode) => `<script>${terserMinify(jsCode).code}</script>`
  );

const src = {
  'index.js': await importRaw('src/index.js'),
  'index.html': await importRaw('src/index.html'),
  '404.html': await importRaw('src/404.html')
}

const workerJs = `
${src["index.js"]}
const HTML_INDEX = \`${minifyHtml(src["index.html"])}\`;
const HTML_404 = \`${minifyHtml(src["404.html"])}\`;
`;

const distDir  = path.join(__dirname, 'dist')
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

await fs.promises.writeFile(path.join(__dirname, 'dist/worker.js'), workerJs.trim())
console.log('build finish');