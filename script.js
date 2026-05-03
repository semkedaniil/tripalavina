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
    return `static/${product.folder}/${n}.jpg`;
}

function formatProductPrice(product) {
    const mainPrice = product.prices?.[0];
    return mainPrice?.value || mainPrice?.label || '';
}

function formatProductPriceNote(product) {
    const label = product.prices?.[0]?.label || '';
    return label.toLowerCase() === 'стоимость' ? '' : label;
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

function generateAllProductCards() {
    const productsGrid = document.querySelector('.gallery-grid');
    if (!productsGrid) return;

    if (!productCategories.length) {
        productsGrid.innerHTML = '<p class="catalog-intro">Каталог не удалось загрузить. Откройте сайт через локальный сервер, чтобы работал fetch для файла products.json.</p>';
        return;
    }

    productsGrid.innerHTML = productCategories.map((product, idx) => {
        const thumbCount = Math.min(productImageCount(product), 4);
        const thumbnails = Array.from({length: thumbCount}, (_, thumbIndex) => {
            const imageUrl = productImageUrl(product, thumbIndex + 1);
            const activeClass = thumbIndex === 0 ? ' active' : '';
            return `<img class="product-thumbnail${activeClass}" src="${escapeHtml(imageUrl)}" data-image="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title)}" loading="lazy">`;
        }).join('');

        return `
            <article class="gallery-item product-showcase" data-product-idx="${idx}" id="product-${idx}">
                <div class="product-main-image">
                    <img src="${escapeHtml(productImageUrl(product, 1))}" alt="${escapeHtml(product.title)}" loading="lazy">
                </div>
                <div class="product-thumbnails">${thumbnails}</div>
                <div class="gallery-overlay">
                    <div class="product-header">
                        <div class="product-header-content">
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
    document.getElementById('productModalTitle').textContent = product.title || '';
    document.getElementById('productModalSubtitle').textContent = product.subtitle || '';
    document.getElementById('productModalBasePrice').textContent = formatProductPrice(product);
    document.getElementById('productModalPriceNote').textContent = formatProductPriceNote(product);

    const specsSection = document.getElementById('productModalSpecsSection');
    const specsList = document.getElementById('productModalSpecs');
    specsList.innerHTML = buildInfoListMarkup(product.specs || []);
    specsSection.style.display = specsList.children.length ? 'block' : 'none';

    const pricesList = document.getElementById('productModalPrices');
    pricesList.innerHTML = buildInfoListMarkup(product.prices || []);

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
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    closeFullscreenPhoto();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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
