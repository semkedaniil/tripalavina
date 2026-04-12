/**
 * Генерирует HTML-страницы товаров из products.json (по одному файлу на slug).
 * Запуск: node scripts/generate-product-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const snippetsDir = path.join(__dirname, 'snippets');

function productImageFileIndex(p, position1Based) {
    if (Array.isArray(p.imageSlots) && p.imageSlots.length >= position1Based) {
        return p.imageSlots[position1Based - 1];
    }
    return position1Based;
}

function productImageCount(p) {
    if (Array.isArray(p.imageSlots) && p.imageSlots.length) {
        return p.imageSlots.length;
    }
    return p.maxThumbs ?? 10;
}

function productImageUrl(p, position1Based) {
    const n = productImageFileIndex(p, position1Based);
    const folder = p.folder;
    if (p.imageLayout === 'flat') {
        const prefix = p.imageBase || p.name;
        return `static/${folder}/${prefix} (${n}).jpg`;
    }
    const inner = p.imageInnerFolder ?? p.imageBase ?? p.name;
    return `static/${folder}/${inner}/${n}.jpg`;
}

function escAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function escText(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
}

const arrowPrev = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;
const arrowNext = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;

function buildProductPage(p, headerHtml, footerHtml) {
    const max = productImageCount(p);
    const nameAttr = escAttr(p.name);
    const nameText = escText(p.name);

    const slides = [];
    const thumbs = [];
    const indicators = [];
    const modalIndicators = [];

    for (let i = 1; i <= max; i++) {
        const src = productImageUrl(p, i);
        const srcAttr = escAttr(src);
        const active = i === 1 ? ' active' : '';
        slides.push(`                            <div class="carousel-slide${active}">
                                <img src="${srcAttr}" alt="${nameAttr}">
                            </div>`);
        thumbs.push(`                        <img src="${srcAttr}" alt="${nameAttr}" class="thumbnail${active}">`);
        indicators.push(`                            <span class="indicator${active}" onclick="goToSlide(${i - 1})"></span>`);
        modalIndicators.push(`                <span class="modal-indicator${active}" onclick="goToModalSlide(${i - 1})"></span>`);
    }

    const priceMain =
        p.priceText != null
            ? `<span class="price">${escText(p.priceText)}</span>`
            : `<span class="price">${escText(Number(p.basePrice).toLocaleString('ru-RU'))}₽</span>`;

    const featureLines = [];
    if (p.subtitle) featureLines.push(`                                <li>${escText(p.subtitle)}</li>`);
    if (p.badge) featureLines.push(`                                <li>${escText(p.badge)}</li>`);
    featureLines.push(`                                <li>${escText(p.priceNote)}</li>`);

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${nameText} - Tripalavina</title>
    <link rel="stylesheet" href="styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
${headerHtml}
    <main>
        <div class="container">
            <div class="breadcrumb">
                <a href="index.html">Главная</a> / <span>${nameText}</span>
            </div>

            <div class="product-content">
                <div class="product-gallery">
                    <div class="carousel-container">
                        <div class="carousel-wrapper">
${slides.join('\n')}
                        </div>

                        <button type="button" class="carousel-arrow carousel-prev" onclick="changeSlide(-1)" aria-label="Предыдущее фото">
                            ${arrowPrev}
                        </button>
                        <button type="button" class="carousel-arrow carousel-next" onclick="changeSlide(1)" aria-label="Следующее фото">
                            ${arrowNext}
                        </button>

                        <div class="carousel-indicators">
${indicators.join('\n')}
                        </div>
                    </div>

                    <div class="thumbnail-gallery">
${thumbs.join('\n')}
                    </div>
                </div>

                <div class="product-info">
                    <h1 class="product-title">${nameText}</h1>

                    <div class="product-price">
                        ${priceMain}
                        <span class="price-note">${escText(p.priceNote)}</span>
                    </div>

                    <div class="product-description">
                        <p>${escText(p.desc)}</p>
                    </div>

                    <div class="product-features">
                        <h3>Кратко о товаре</h3>
                        <ul>
${featureLines.join('\n')}
                        </ul>
                    </div>

                    <div class="product-delivery">
                        <h3>Доставка</h3>
                        <ul>
                            <li>Доставка по России и СНГ транспортной компанией по запросу</li>
                            <li>Работаем с физическими и юридическими лицами</li>
                            <li>Точные размеры, цвета и сроки — в Telegram или WhatsApp</li>
                        </ul>
                    </div>

                    <div class="product-actions">
                        <a href="https://t.me/tripalavinastore" class="btn btn-primary" target="_blank" rel="noopener">
                            Заказать в Telegram
                        </a>
                        <a href="https://wa.me/79080599762" class="btn btn-secondary" target="_blank" rel="noopener">
                            Написать в WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </main>

${footerHtml}
    <div id="imageModal" class="image-modal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal()" role="button" tabindex="0" aria-label="Закрыть"></span>
            <img id="modalImage" src="" alt="${nameAttr}">
            <div class="modal-navigation">
                <button type="button" class="modal-arrow modal-prev" onclick="changeModalSlide(-1)" aria-label="Предыдущее">
                    ${arrowPrev}
                </button>
                <button type="button" class="modal-arrow modal-next" onclick="changeModalSlide(1)" aria-label="Следующее">
                    ${arrowNext}
                </button>
            </div>
            <div class="modal-indicators">
${modalIndicators.join('\n')}
            </div>
        </div>
    </div>

    <script src="product-detail.js"></script>
</body>
</html>
`;
}

const productsPath = path.join(root, 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const headerHtml = fs.readFileSync(path.join(snippetsDir, 'product-header.html'), 'utf8');
const footerHtml = fs.readFileSync(path.join(snippetsDir, 'product-footer.html'), 'utf8');

let written = 0;
let skipped = 0;

for (const p of products) {
    if (p.skipPage) {
        skipped++;
        console.log('Пропуск (своя страница):', p.slug || p.name);
        continue;
    }
    if (!p.slug) {
        console.warn('Нет slug:', p.name);
        continue;
    }
    const html = buildProductPage(p, headerHtml, footerHtml);
    const outPath = path.join(root, `${p.slug}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    written++;
    console.log('Записано:', p.slug + '.html');
}

console.log(`Готово: ${written} файлов, пропущено ${skipped}.`);
