// ======================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ========================
let productCategories = [];
const productTextCache = new Map();
const modalState = {
    product: null,
    images: [],
    currentIndex: 0
};

// ======================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ========================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, (char) => {
        if (char === '&') return '&amp;';
        if (char === '<') return '&lt;';
        if (char === '>') return '&gt;';
        return '&quot;';
    });
}

function productImageFileIndex(product, position1Based) {
    if (Array.isArray(product.imageSlots) && product.imageSlots.length >= position1Based) {
        return product.imageSlots[position1Based - 1];
    }
    return position1Based;
}

function productImageCount(product) {
    if (Array.isArray(product.imageSlots) && product.imageSlots.length) {
        return product.imageSlots.length;
    }
    return product.maxThumbs ?? 10;
}

function productImageUrl(product, position1Based) {
    const n = productImageFileIndex(product, position1Based);
    const folder = product.folder;
    if (product.imageLayout === 'flat') {
        const prefix = product.imageBase || product.name;
        return `static/${folder}/${prefix} (${n}).jpg`;
    }
    const inner = product.imageInnerFolder ?? product.imageBase ?? product.name;
    return `static/${folder}/${inner}/${n}.jpg`;
}

function productTextCandidates(product) {
    const inner = product.imageInnerFolder ?? product.imageBase ?? product.name;
    return [
        `static/${product.folder}/${inner}/Описание к товару.txt`,
        `static/${product.folder}/${inner}/Описание товара.txt`,
        `static/${product.folder}/Описание к товару.txt`,
        `static/${product.folder}/Описание товара.txt`
    ];
}

function toFetchablePath(path) {
    return encodeURI(path).replace(/#/g, '%23');
}

function formatRub(value, withPrefix = true) {
    if (value == null || Number.isNaN(Number(value))) return '';
    const amount = Number(value).toLocaleString('ru-RU');
    return withPrefix ? `от ${amount} руб.` : `${amount} руб.`;
}

function formatProductPrice(product) {
    if (product.priceText) return product.priceText;
    return formatRub(product.basePrice, true);
}

// ======================== ОБРАБОТКА ИЗОБРАЖЕНИЙ ========================
function attachImageFallback(image) {
    if (!image || image.dataset.fallbackBound === 'true') return;

    image.dataset.fallbackBound = 'true';
    image.addEventListener('error', function handleImageError() {
        if (this.src.includes('placehold.co')) return;

        const cleanSrc = this.src.split('?')[0];
        const stem = cleanSrc.replace(/\.[^/.]+$/, '');
        const variants = ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG'].map((ext) => stem + ext);
        let next = Number(this.dataset.imgExtNext || 0);

        while (next < variants.length) {
            const nextSrc = variants[next];
            next += 1;
            if (nextSrc !== cleanSrc) {
                this.dataset.imgExtNext = String(next);
                this.src = nextSrc;
                return;
            }
        }

        this.src = 'https://placehold.co/800x600/111111/ffffff?text=Tripalavina';
    });
}

function bindImageFallbacks(root = document) {
    root.querySelectorAll('img').forEach(attachImageFallback);
}

// ======================== ЗАГРУЗКА ДАННЫХ ========================
async function loadProductCategories() {
    const response = await fetch('products.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`products.json: ${response.status}`);
    productCategories = await response.json();
}

// ======================== УЛУЧШЕННЫЙ ПАРСЕР ========================
// 1. Распознавание опций с ценой (например "480х480х130мм - 6500р")
function parseOptionLine(line) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    // Пропускаем строки-заголовки
    if (/^(стоимость|цены|опции|дополнительно|варианты):?$/i.test(normalized)) return null;

    // Ищем цену в конце строки или после дефиса
    let priceMatch = normalized.match(/(\d[\d\s]*)\s*(р|руб|₽)?\.?$/i);
    if (!priceMatch) {
        priceMatch = normalized.match(/[-–—]\s*(\d[\d\s]*)\s*(р|руб|₽)?\.?$/i);
    }
    if (!priceMatch) return null;

    let priceValue = priceMatch[1].replace(/\s/g, '');
    const currency = priceMatch[2] || 'р';
    const price = `${priceValue}${currency}`;

    // Извлекаем название опции (всё до цены)
    let label = normalized.replace(priceMatch[0], '').replace(/[-–—:*]\s*$/, '').trim();
    if (!label) label = 'Комплектация';
    label = label.replace(/^\*\s*/, ''); // убираем звёздочку

    if (!label || /^[-\s–—]+$/.test(label)) label = 'Дополнительно';

    return { label, price, isFeature: false };
}

// 2. Извлечение структурированных характеристик (без цены) — размеры, вес, доставка и т.п.
function extractStructuredFeatures(lines) {
    const features = [];
    const remainingLines = [];

    const featurePatterns = [
        /^✅/, /^•/, /^\*/, /^🌲/, /^🚚/,
        /^(нижняя площадка|верхняя площадка|четыре колонны|общая высота|общий вес|цвет изделия|подставка имеет)/i,
        /^(размер|вес|материал|отделка|доставка|производство|гарантия)/i,
        /^в наличии и под заказ:/i,
        /^подставка имеет/i
    ];

    for (const line of lines) {
        const isFeature = featurePatterns.some(pattern => pattern.test(line));
        if (isFeature) {
            let cleanLine = line.replace(/^[✅•*🌲🚚]\s*/, '');
            features.push(cleanLine);
        } else {
            remainingLines.push(line);
        }
    }

    return { features, remainingLines };
}

// 3. Главная функция парсинга текста
function parseProductText(text, product) {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const productNameNorm = (product.name || '').toLowerCase();
    const cleanLines = lines.filter(line => line.toLowerCase() !== productNameNorm);

    // Извлекаем фичи (без цены) и остальные строки
    const { features, remainingLines } = extractStructuredFeatures(cleanLines);

    const description = [];
    const options = [];

    for (const line of remainingLines) {
        // Пробуем распознать опцию с ценой
        const priceOption = parseOptionLine(line);
        if (priceOption) {
            options.push(priceOption);
            continue;
        }

        // Пропускаем явные заголовки
        if (/^(стоимость|цены|опции|дополнительно|варианты|основные преимущества|доступные размеры|доставка|кратко о товаре):?$/i.test(line)) {
            continue;
        }

        // Всё остальное — в описание
        description.push(line.replace(/^\d+\.\s*/, ''));
    }

    // Добавляем извлечённые характеристики как опции без цены
    for (const feat of features) {
        const parts = feat.split(':');
        if (parts.length >= 2) {
            const label = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            options.push({ label, price: value, isFeature: true });
        } else {
            // Если нет двоеточия, кладём всю строку как label, а цену прочерком
            options.push({ label: feat, price: '', isFeature: true });
        }
    }

    return {
        description: description.slice(0, 10),
        options
    };
}

// ======================== ПОСТРОЕНИЕ КАРТОЧЕК ========================
function buildProductImages(product, maxCount = productImageCount(product)) {
    return Array.from({ length: maxCount }, (_, index) => productImageUrl(product, index + 1));
}

function generateAllProductCards() {
    const productsGrid = document.querySelector('.gallery-grid');
    if (!productsGrid) return;

    if (!productCategories.length) {
        productsGrid.innerHTML = '<p class="catalog-intro">Каталог не удалось загрузить. Откройте сайт через локальный сервер, чтобы работал fetch для файла products.json.</p>';
        return;
    }

    productsGrid.innerHTML = productCategories.map((product, idx) => {
        const thumbCount = Math.min(productImageCount(product), 4);
        const thumbnails = Array.from({ length: thumbCount }, (_, thumbIndex) => {
            const imageUrl = productImageUrl(product, thumbIndex + 1);
            const activeClass = thumbIndex === 0 ? ' active' : '';
            return `<img class="product-thumbnail${activeClass}" src="${escapeHtml(imageUrl)}" data-image="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`;
        }).join('');

        return `
            <article class="gallery-item product-showcase" data-product-idx="${idx}" id="product-${idx}">
                <div class="product-main-image">
                    <img src="${escapeHtml(productImageUrl(product, 1))}" alt="${escapeHtml(product.name)}" loading="lazy">
                </div>
                <div class="product-thumbnails">${thumbnails}</div>
                <div class="gallery-overlay">
                    <div class="product-header">
                        <div class="product-header-content">
                            <h3>${escapeHtml(product.name)}</h3>
                            <div class="product-subtitle">${escapeHtml(product.subtitle || '')}</div>
                            <div class="product-description-short">${escapeHtml(product.desc || '')}</div>
                            <div class="product-price-inline">
                                <span class="price">${escapeHtml(formatProductPrice(product))}</span>
                                <span class="price-note">${escapeHtml(product.priceNote || '')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-meta-row click-hint">
                        Подробнее
                    </div>
                </div>
            </article>
        `;
    }).join('');

    bindImageFallbacks(productsGrid);
}

function initDynamicThumbnailGalleries() {
    document.querySelectorAll('.product-showcase').forEach((card) => {
        const mainImage = card.querySelector('.product-main-image img');
        const thumbnails = Array.from(card.querySelectorAll('.product-thumbnail'));
        if (!mainImage || !thumbnails.length) return;

        thumbnails.forEach((thumbnail) => {
            thumbnail.addEventListener('click', (event) => {
                event.stopPropagation();
                thumbnails.forEach((thumb) => thumb.classList.remove('active'));
                thumbnail.classList.add('active');
                mainImage.style.opacity = '0.45';
                requestAnimationFrame(() => {
                    mainImage.src = thumbnail.dataset.image || thumbnail.src;
                    mainImage.alt = thumbnail.alt || 'Tripalavina';
                    mainImage.style.opacity = '1';
                });
            });
        });
    });
}

// ======================== МОДАЛЬНОЕ ОКНО ========================
function renderModalImage() {
    const modalImage = document.getElementById('productModalImage');
    const modalThumbs = document.getElementById('productModalThumbs');
    if (!modalImage || !modalThumbs || !modalState.images.length) return;

    modalImage.src = modalState.images[modalState.currentIndex];
    modalImage.alt = modalState.product?.name || 'Tripalavina';

    modalThumbs.innerHTML = modalState.images.map((image, index) => {
        const activeClass = index === modalState.currentIndex ? ' is-active' : '';
        return `<img class="product-modal-thumb${activeClass}" src="${escapeHtml(image)}" data-image-index="${index}" alt="${escapeHtml(modalState.product?.name || '')}" loading="lazy">`;
    }).join('');

    bindImageFallbacks(modalThumbs);

    modalThumbs.querySelectorAll('.product-modal-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
            modalState.currentIndex = Number(thumb.dataset.imageIndex);
            renderModalImage();
        });
    });
}

function changeModalImage(direction) {
    if (!modalState.images.length) return;
    modalState.currentIndex = (modalState.currentIndex + direction + modalState.images.length) % modalState.images.length;
    renderModalImage();
}

function buildOptionsMarkup(product, parsed) {
    let options = [...parsed.options];

    if (!options.length) {
        options.push({
            label: 'Базовая комплектация',
            price: formatProductPrice(product),
            isFeature: false
        });
    }

    return options.map(option => {
        const displayPrice = option.isFeature ? (option.price || '') : option.price;
        return `
            <li>
                <span>${escapeHtml(option.label)}</span>
                <span>${escapeHtml(displayPrice)}</span>
            </li>
        `;
    }).join('');
}

async function openProductModal(productIndex) {
    const product = productCategories[productIndex];
    const modal = document.getElementById('productModal');
    if (!product || !modal) return;

    modalState.product = product;
    modalState.images = buildProductImages(product);
    modalState.currentIndex = 0;

    const rawText = await loadProductText(product);
    const parsedText = parseProductText(rawText, product);

    document.getElementById('productModalBadge').textContent = product.badge || '';
    document.getElementById('productModalTitle').textContent = product.name || '';
    document.getElementById('productModalSubtitle').textContent = product.subtitle || '';
    document.getElementById('productModalBasePrice').textContent = formatProductPrice(product);
    document.getElementById('productModalPriceNote').textContent = product.priceNote || '';

    const descriptionContainer = document.getElementById('productModalDescription');
    const descriptionItems = parsedText.description.length ? parsedText.description : [product.desc || ''];
    descriptionContainer.innerHTML = descriptionItems
        .slice(0, 5)
        .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');

    const optionsSection = document.getElementById('productModalOptionsSection');
    const optionsList = document.getElementById('productModalOptions');
    optionsList.innerHTML = buildOptionsMarkup(product, parsedText);
    optionsSection.style.display = optionsList.children.length ? 'block' : 'none';

    renderModalImage();
    bindImageFallbacks(modal);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function loadProductText(product) {
    if (productTextCache.has(product.slug)) return productTextCache.get(product.slug);

    for (const candidate of productTextCandidates(product)) {
        try {
            const response = await fetch(toFetchablePath(candidate), { cache: 'force-cache' });
            if (!response.ok) continue;

            const text = await response.text();
            if (text.trim()) {
                productTextCache.set(product.slug, text);
                return text;
            }
        } catch (error) {
            console.warn('Cannot load product text', candidate, error);
        }
    }

    const fallback = `${product.name}\n\n${product.desc || ''}`;
    productTextCache.set(product.slug, fallback);
    return fallback;
}

function initProductCardClicks() {
    document.querySelectorAll('.product-showcase').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('.product-thumbnail')) return;
            const productIndex = Number(card.dataset.productIdx);
            openProductModal(productIndex);
        });
    });
}

function initModalControls() {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-modal="true"]')) {
            closeProductModal();
        }
    });

    modal.querySelector('.product-modal-prev')?.addEventListener('click', () => changeModalImage(-1));
    modal.querySelector('.product-modal-next')?.addEventListener('click', () => changeModalImage(1));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeProductModal();
        if (!modal.classList.contains('is-open')) return;
        if (event.key === 'ArrowLeft') changeModalImage(-1);
        if (event.key === 'ArrowRight') changeModalImage(1);
    });
}

// ======================== ИНИЦИАЛИЗАЦИЯ ========================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadProductCategories();
    } catch (error) {
        console.warn(error);
        productCategories = [];
    }

    generateAllProductCards();
    initDynamicThumbnailGalleries();
    initProductCardClicks();
    initModalControls();
});

// ======================== СТИЛИ ДЛЯ СКРУГЛЁННОГО СКРОЛЛА (добавим динамически) ========================
const style = document.createElement('style');
style.textContent = `
    .product-modal-dialog {
        scrollbar-width: thin;
        scrollbar-color: rgba(196, 154, 108, 0.65) rgba(255, 255, 255, 0.06);
    }
    .product-modal-dialog::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .product-modal-dialog::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.06);
        border-radius: 10px;
    }
    .product-modal-dialog::-webkit-scrollbar-thumb {
        background: rgba(196, 154, 108, 0.65);
        border-radius: 10px;
    }
    .product-modal-dialog::-webkit-scrollbar-thumb:hover {
        background: rgba(196, 154, 108, 0.85);
    }
`;
document.head.appendChild(style);