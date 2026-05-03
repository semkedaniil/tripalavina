// ======================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ========================
let productCategories = [];
const modalState = {
    product: null,
    images: [],
    currentIndex: 0
};
const fullscreenState = {
    isOpen: false
};

let catalogFilter = {category: '', search: ''};

const CATEGORY_LABELS = {
    panels: 'Панели\u00A0и\u00A0ширмы',
    diffusers: 'Диффузоры',
    bass: 'Бас-ловушки',
    furniture: 'Мебель\u00A0и\u00A0стойки',
    accessories: 'Аксессуары'
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

/** Кодирует сегменты пути (кириллица, пробелы, запятые) для корректной загрузки img/src и fetch */
function staticAssetUrl(relPath) {
    if (!relPath || /^(https?:|data:)/i.test(String(relPath))) return relPath;
    return String(relPath)
        .split('/')
        .map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg)))
        .join('/');
}

function productImageFileIndex(product, position1Based) {
    if (Array.isArray(product.imageSlots) && product.imageSlots.length >= position1Based) {
        return product.imageSlots[position1Based - 1];
    }
    return position1Based;
}

function productImageCount(product) {
    if (Array.isArray(product.imageNames) && product.imageNames.length) {
        return product.imageNames.length;
    }
    if (Array.isArray(product.imageSlots) && product.imageSlots.length) {
        return product.imageSlots.length;
    }
    return product.maxThumbs ?? 10;
}

function productImageUrl(product, position1Based) {
    const i = position1Based - 1;
    if (Array.isArray(product.imageNames) && product.imageNames[i]) {
        return staticAssetUrl(`static/${product.folder}/${product.imageNames[i]}`);
    }
    const n = productImageFileIndex(product, position1Based);
    return staticAssetUrl(`static/${product.folder}/${n}.jpg`);
}

/** Первое фото для блока «примеры в интерьерах»: interiorImages из JSON или первое каталожное */
function productCaseShowcaseUrls(product) {
    const fromJson = Array.isArray(product.interiorImages)
        ? product.interiorImages.filter((u) => typeof u === 'string' && u.trim()).map(staticAssetUrl)
        : [];
    if (fromJson.length) return fromJson;
    return [productImageUrl(product, 1)];
}

function formatProductPrice(product) {
    const mainPrice = product.prices?.[0];
    return mainPrice?.value || mainPrice?.label || '';
}

function formatProductPriceNote(product) {
    const label = product.prices?.[0]?.label || '';
    return label.toLowerCase() === 'стоимость' ? '' : label;
}

function formatAvailabilityLabel(product) {
    const a = product.availability || 'order';
    if (a === 'in_stock') return 'В\u00A0наличии';
    if (a === 'request') return 'Цена\u00A0и\u00A0срок по\u00A0запросу';
    return 'Под\u00A0заказ';
}

function productMatchesFilter(product, category, searchRaw) {
    if (category && product.category !== category) return false;
    const q = (searchRaw || '').trim().toLowerCase();
    if (!q) return true;
    const hay = [product.title, product.subtitle, product.summary, product.badge]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

function getFilteredCatalogEntries() {
    return productCategories
        .map((product, idx) => ({product, idx}))
        .filter(({product}) => productMatchesFilter(product, catalogFilter.category, catalogFilter.search));
}

function setProductQueryParam(idx) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('p', String(idx));
        history.replaceState(null, '', url);
    } catch (_) {
        /* file:// и т.п. */
    }
}

function clearProductQueryParam() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('p');
        const qs = url.searchParams.toString();
        history.replaceState(null, '', url.pathname + (qs ? `?${qs}` : '') + url.hash);
    } catch (_) {
        /* file:// */
    }
}

function tryOpenProductFromQuery() {
    let raw;
    try {
        raw = new URLSearchParams(window.location.search).get('p');
    } catch (_) {
        return;
    }
    if (raw === null || raw === '') return;
    const idx = parseInt(raw, 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= productCategories.length) return;
    requestAnimationFrame(() => openProductModal(idx));
}

// ======================== ОБРАБОТКА ИЗОБРАЖЕНИЙ ========================
function attachImageFallback(image) {
    if (!image || image.dataset.fallbackBound === 'true') return;

    image.dataset.fallbackBound = 'true';
    image.addEventListener('error', function handleImageError() {
        if (this.src.includes('placehold.co')) return;

        const cleanSrc = this.src.split('?')[0];
        const stem = cleanSrc.replace(/\.[^/.]+$/, '');
        const variants = ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG', '.webp', '.WEBP'].map((ext) => stem + ext);
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
    const response = await fetch('products.json', {cache: 'no-store'});
    if (!response.ok) throw new Error(`products.json: ${response.status}`);
    productCategories = await response.json();
}

// ======================== ПОСТРОЕНИЕ КАРТОЧЕК ========================
function buildProductImages(product) {
    return Array.from({length: productImageCount(product)}, (_, index) => productImageUrl(product, index + 1));
}

function buildInfoListMarkup(items = []) {
    return items.map((item) => {
        const label = item.label ?? '';
        const value = item.value ?? '';
        return `
            <li>
                <span>${escapeHtml(label)}</span>
                <span>${escapeHtml(value)}</span>
            </li>
        `;
    }).join('');
}

/** Индексы товаров для блока «примеры»: меньше карточек, равномерно по каталогу */
function getCasesGalleryProductIndices(total, limit) {
    if (total === 0) return [];
    if (total <= limit) return [...Array(total).keys()];
    const out = [];
    const last = total - 1;
    for (let k = 0; k < limit; k++) {
        out.push(Math.round((k * last) / (limit - 1)));
    }
    return [...new Set(out)].sort((a, b) => a - b);
}

const CASES_GALLERY_CARD_LIMIT = 6;

function generateCasesGallery() {
    const grid = document.querySelector('.cases-grid');
    if (!grid) return;

    if (!productCategories.length) {
        grid.innerHTML = '';
        return;
    }

    const indices = getCasesGalleryProductIndices(productCategories.length, CASES_GALLERY_CARD_LIMIT);

    grid.innerHTML = indices.map((idx, slot) => {
        const product = productCategories[idx];
        const showcaseUrls = productCaseShowcaseUrls(product);
        const src = showcaseUrls[0];
        const title = product.title || 'Tripalavina';
        const summary = product.summary || '';
        const label = `Открыть карточку: ${title}`;
        return `
            <article class="case-card" data-product-idx="${idx}" role="button" tabindex="0" aria-label="${escapeHtml(label)}">
                <img src="${escapeHtml(src)}" alt="" loading="${slot < 2 ? 'eager' : 'lazy'}" decoding="async">
                <div class="case-card-copy">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(summary)}</p>
                </div>
            </article>
        `;
    }).join('');

    bindImageFallbacks(grid);
}

function initCaseGalleryInteractions() {
    const grid = document.querySelector('.cases-grid');
    if (!grid) return;

    grid.addEventListener('click', (event) => {
        const card = event.target.closest('.case-card[data-product-idx]');
        if (!card) return;
        openProductModal(Number(card.dataset.productIdx));
    });

    grid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const card = event.target.closest('.case-card[data-product-idx]');
        if (!card) return;
        event.preventDefault();
        openProductModal(Number(card.dataset.productIdx));
    });
}

function renderCatalogSkeleton() {
    const productsGrid = document.getElementById('galleryGrid') || document.querySelector('.gallery-grid');
    if (!productsGrid) return;
    productsGrid.innerHTML = Array.from({length: 6}, () => `
        <article class="catalog-skeleton-card" aria-hidden="true">
            <div class="catalog-skeleton-img"></div>
            <div class="catalog-skeleton-line catalog-skeleton-line--lg"></div>
            <div class="catalog-skeleton-line"></div>
            <div class="catalog-skeleton-line catalog-skeleton-line--sm"></div>
        </article>
    `).join('');
}

function showCatalogLoadError() {
    const productsGrid = document.getElementById('galleryGrid') || document.querySelector('.gallery-grid');
    const msg = document.getElementById('catalogMessage');
    if (productsGrid) {
        productsGrid.innerHTML = '';
    }
    if (msg) {
        msg.hidden = false;
        msg.innerHTML = `
            <p class="catalog-message__text">Не\u00A0удалось загрузить каталог. Проверьте соединение или откройте сайт через локальный сервер (fetch к\u00A0products.json).</p>
            <button type="button" class="btn btn-primary catalog-retry-btn">Повторить</button>
        `;
        const btn = msg.querySelector('.catalog-retry-btn');
        btn?.addEventListener('click', () => {
            msg.hidden = true;
            msg.innerHTML = '';
            bootstrapCatalog();
        });
    }
    const countEl = document.getElementById('catalogCount');
    if (countEl) countEl.textContent = '';
}

function updateCatalogCount(visible, total) {
    const countEl = document.getElementById('catalogCount');
    if (!countEl) return;
    if (!total) {
        countEl.textContent = '';
        return;
    }
    countEl.textContent = visible === total ? `Товаров: ${total}` : `Показано: ${visible}\u00A0из\u00A0${total}`;
}

function syncCatalogChipState() {
    document.querySelectorAll('.catalog-chip').forEach((btn) => {
        const on = btn.dataset.category === catalogFilter.category;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
}

function generateAllProductCards() {
    const productsGrid = document.getElementById('galleryGrid') || document.querySelector('.gallery-grid');
    const msg = document.getElementById('catalogMessage');
    if (!productsGrid) return;

    if (msg) {
        msg.hidden = true;
        msg.innerHTML = '';
    }

    if (!productCategories.length) {
        updateCatalogCount(0, 0);
        productsGrid.innerHTML = '<p class="catalog-intro">Каталог пуст. Проверьте файл\u00A0products.json.</p>';
        return;
    }

    const entries = getFilteredCatalogEntries();
    updateCatalogCount(entries.length, productCategories.length);

    if (!entries.length) {
        productsGrid.innerHTML = '<p class="catalog-empty">По\u00A0вашему запросу ничего не\u00A0найдено. Сбросьте поиск или\u00A0выберите другую категорию.</p>';
        bindImageFallbacks(productsGrid);
        return;
    }

    productsGrid.innerHTML = entries.map(({product, idx}) => {
        const thumbCount = Math.min(productImageCount(product), 4);
        const thumbnails = Array.from({length: thumbCount}, (_, thumbIndex) => {
            const imageUrl = productImageUrl(product, thumbIndex + 1);
            const activeClass = thumbIndex === 0 ? ' active' : '';
            return `<img class="product-thumbnail${activeClass}" src="${escapeHtml(imageUrl)}" data-image="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title)}" loading="lazy">`;
        }).join('');

        const catLabel = product.category ? (CATEGORY_LABELS[product.category] || '') : '';
        const stock = formatAvailabilityLabel(product);

        return `
            <article class="gallery-item product-showcase" data-product-idx="${idx}" id="product-${idx}">
                <div class="product-main-image">
                    <img src="${escapeHtml(productImageUrl(product, 1))}" alt="${escapeHtml(product.title)}" loading="lazy">
                </div>
                <div class="product-thumbnails">${thumbnails}</div>
                <div class="gallery-overlay">
                    <div class="product-header">
                        <div class="product-header-content">
                            <div class="product-card-meta">
                                ${catLabel ? `<span class="product-card-category">${escapeHtml(catLabel)}</span>` : ''}
                                <span class="product-stock-pill">${escapeHtml(stock)}</span>
                            </div>
                            <h3>${escapeHtml(product.title)}</h3>
                            <div class="product-subtitle">${escapeHtml(product.subtitle || '')}</div>
                            <div class="product-description-short">${escapeHtml(product.summary || '')}</div>
                            <div class="product-price-inline">
                                <span class="price">${escapeHtml(formatProductPrice(product))}</span>
                                <span class="price-note">${escapeHtml(formatProductPriceNote(product))}</span>
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
    modalImage.alt = modalState.product?.title || 'Tripalavina';
    modalImage.dataset.imageIndex = String(modalState.currentIndex);

    modalThumbs.innerHTML = modalState.images.map((image, index) => {
        const activeClass = index === modalState.currentIndex ? ' is-active' : '';
        return `<img class="product-modal-thumb${activeClass}" src="${escapeHtml(image)}" data-image-index="${index}" alt="${escapeHtml(modalState.product?.title || '')}" loading="lazy">`;
    }).join('');

    bindImageFallbacks(modalThumbs);

    modalThumbs.querySelectorAll('.product-modal-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
            modalState.currentIndex = Number(thumb.dataset.imageIndex);
            renderModalImage();
        });
    });

    if (!modalImage.dataset.fullscreenBound) {
        modalImage.dataset.fullscreenBound = 'true';
        modalImage.addEventListener('click', () => openFullscreenPhoto(modalState.currentIndex));
    }
}

function changeModalImage(direction) {
    if (!modalState.images.length) return;
    modalState.currentIndex = (modalState.currentIndex + direction + modalState.images.length) % modalState.images.length;
    renderModalImage();
}

function ensureFullscreenModal() {
    let modal = document.getElementById('photoFullscreenModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'photoFullscreenModal';
    modal.className = 'photo-fullscreen-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <button type="button" class="photo-fullscreen-close" aria-label="Закрыть фото" data-close-fullscreen="true"></button>
        <button type="button" class="photo-fullscreen-arrow photo-fullscreen-prev" aria-label="Предыдущее фото">&#8249;</button>
        <figure class="photo-fullscreen-stage">
            <img id="photoFullscreenImage" src="" alt="">
            <figcaption id="photoFullscreenCaption" class="photo-fullscreen-caption"></figcaption>
        </figure>
        <button type="button" class="photo-fullscreen-arrow photo-fullscreen-next" aria-label="Следующее фото">&#8250;</button>
        <div id="photoFullscreenThumbs" class="photo-fullscreen-thumbs"></div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-fullscreen="true"]')) {
            closeFullscreenPhoto();
            return;
        }

        if (!event.target.closest('#photoFullscreenImage')) {
            closeFullscreenPhoto();
        }
    });

    modal.querySelector('.photo-fullscreen-prev')?.addEventListener('click', (event) => {
        event.stopPropagation();
        changeFullscreenPhoto(-1);
    });

    modal.querySelector('.photo-fullscreen-next')?.addEventListener('click', (event) => {
        event.stopPropagation();
        changeFullscreenPhoto(1);
    });

    return modal;
}

function renderFullscreenPhoto() {
    const modal = ensureFullscreenModal();
    const image = document.getElementById('photoFullscreenImage');
    const caption = document.getElementById('photoFullscreenCaption');
    const thumbs = document.getElementById('photoFullscreenThumbs');
    if (!modal || !image || !caption || !thumbs || !modalState.images.length) return;

    const imageAlt = modalState.product?.title || 'Tripalavina';
    image.src = modalState.images[modalState.currentIndex];
    image.alt = imageAlt;
    caption.textContent = `${modalState.currentIndex + 1} / ${modalState.images.length}`;

    thumbs.innerHTML = modalState.images.map((src, index) => {
        const activeClass = index === modalState.currentIndex ? ' is-active' : '';
        return `<img class="photo-fullscreen-thumb${activeClass}" src="${escapeHtml(src)}" alt="${escapeHtml(imageAlt)}" data-image-index="${index}" loading="lazy">`;
    }).join('');
    bindImageFallbacks(thumbs);

    thumbs.querySelectorAll('.photo-fullscreen-thumb').forEach((thumb) => {
        thumb.addEventListener('click', (event) => {
            event.stopPropagation();
            modalState.currentIndex = Number(thumb.dataset.imageIndex);
            renderModalImage();
            renderFullscreenPhoto();
        });
    });
}

function openFullscreenPhoto(index = modalState.currentIndex) {
    if (!modalState.images.length) return;
    const modal = ensureFullscreenModal();
    modalState.currentIndex = index;
    fullscreenState.isOpen = true;
    renderModalImage();
    renderFullscreenPhoto();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeFullscreenPhoto() {
    const modal = document.getElementById('photoFullscreenModal');
    fullscreenState.isOpen = false;
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('productModal')?.classList.contains('is-open')) {
        document.body.style.overflow = '';
    }
}

function changeFullscreenPhoto(direction) {
    changeModalImage(direction);
    renderFullscreenPhoto();
}

function openProductModal(productIndex) {
    const product = productCategories[productIndex];
    const modal = document.getElementById('productModal');
    if (!product || !modal) return;

    modalState.product = product;
    modalState.images = buildProductImages(product);
    modalState.currentIndex = 0;

    document.getElementById('productModalBadge').textContent = product.badge || '';
    const stockEl = document.getElementById('productModalStock');
    if (stockEl) {
        stockEl.textContent = formatAvailabilityLabel(product);
    }
    document.getElementById('productModalTitle').textContent = product.title || '';
    document.getElementById('productModalSubtitle').textContent = product.subtitle || '';
    document.getElementById('productModalBasePrice').textContent = formatProductPrice(product);
    document.getElementById('productModalPriceNote').textContent = formatProductPriceNote(product);

    const specsSection = document.getElementById('productModalSpecsSection');
    const specsList = document.getElementById('productModalSpecs');
    specsList.innerHTML = buildInfoListMarkup(product.specs || []);
    specsSection.style.display = specsList.children.length ? 'block' : 'none';

    const pricesList = document.getElementById('productModalPrices');
    const priceRows = product.prices || [];
    if (priceRows.length <= 1) {
        pricesList.innerHTML = '';
        pricesList.hidden = true;
    } else {
        pricesList.hidden = false;
        pricesList.innerHTML = buildInfoListMarkup(priceRows);
    }

    const descriptionContainer = document.getElementById('productModalDescription');
    const descriptionItems = Array.isArray(product.description) && product.description.length
        ? product.description
        : [product.summary || ''];
    descriptionContainer.innerHTML = descriptionItems
        .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');

    renderModalImage();
    bindImageFallbacks(modal);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const dialog = modal.querySelector('.product-modal-dialog');
    if (dialog) {
        dialog.scrollTop = 0;
        dialog.scrollLeft = 0;
    }

    setProductQueryParam(productIndex);
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    closeFullscreenPhoto();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearProductQueryParam();
}

function initProductGridDelegation() {
    const grid = document.getElementById('galleryGrid') || document.querySelector('.gallery-grid');
    if (!grid || grid.dataset.delegationBound === 'true') return;
    grid.dataset.delegationBound = 'true';
    grid.addEventListener('click', (event) => {
        if (event.target.closest('.product-thumbnail')) return;
        const card = event.target.closest('.product-showcase[data-product-idx]');
        if (!card) return;
        const productIndex = Number(card.dataset.productIdx);
        if (Number.isNaN(productIndex)) return;
        openProductModal(productIndex);
    });
}

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

function initCatalogToolbar() {
    const chips = document.getElementById('catalogChips');
    const search = document.getElementById('catalogSearch');
    if (chips) {
        chips.addEventListener('click', (event) => {
            const btn = event.target.closest('.catalog-chip[data-category]');
            if (!btn) return;
            catalogFilter.category = btn.dataset.category ?? '';
            syncCatalogChipState();
            generateAllProductCards();
            initDynamicThumbnailGalleries();
        });
    }
    if (search) {
        const run = debounce(() => {
            catalogFilter.search = search.value;
            generateAllProductCards();
            initDynamicThumbnailGalleries();
        }, 220);
        search.addEventListener('input', run);
        search.addEventListener('search', run);
    }
}

function refreshCatalogAfterLoad() {
    syncCatalogChipState();
    const search = document.getElementById('catalogSearch');
    if (search) search.value = '';
    catalogFilter = {category: '', search: ''};
    generateCasesGallery();
    initCaseGalleryInteractions();
    generateAllProductCards();
    initDynamicThumbnailGalleries();
    initProductGridDelegation();
    tryOpenProductFromQuery();
}

async function bootstrapCatalog() {
    renderCatalogSkeleton();
    try {
        await loadProductCategories();
        refreshCatalogAfterLoad();
    } catch (error) {
        console.warn(error);
        productCategories = [];
        showCatalogLoadError();
    }
}

function initModalControls() {
    const modal = document.getElementById('productModal');
    if (!modal) return;


    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-modal="true"]') || event.target === modal) {
            closeProductModal();
        }
    });

    modal.querySelector('.product-modal-prev')?.addEventListener('click', () => changeModalImage(-1));
    modal.querySelector('.product-modal-next')?.addEventListener('click', () => changeModalImage(1));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (fullscreenState.isOpen) {
                closeFullscreenPhoto();
                return;
            }
            closeProductModal();
        }
        if (!modal.classList.contains('is-open')) return;
        if (event.key === 'ArrowLeft') {
            fullscreenState.isOpen ? changeFullscreenPhoto(-1) : changeModalImage(-1);
        }
        if (event.key === 'ArrowRight') {
            fullscreenState.isOpen ? changeFullscreenPhoto(1) : changeModalImage(1);
        }
    });
}

// ======================== ИНИЦИАЛИЗАЦИЯ ========================
document.addEventListener('DOMContentLoaded', () => {
    initCatalogToolbar();
    initModalControls();
    bootstrapCatalog();
});
