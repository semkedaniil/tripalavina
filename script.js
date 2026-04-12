// script.js - Tripalavina Interactive Gallery & Navigation

// ======================== UTILITY FUNCTIONS ========================

/**
 * Debounce function to limit the rate at which a function can fire
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if an element is in the viewport (with threshold at 70% from bottom)
 */
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    return (
        rect.bottom >= windowHeight * 0.7 &&
        rect.top <= windowHeight
    );
}

// ======================== NAVIGATION & SCROLL ========================

/**
 * Update active navigation link based on current scroll position
 */
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const footer = document.querySelector('footer[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    let currentElement = null;

    sections.forEach(section => {
        if (isElementInViewport(section)) {
            currentElement = section;
        }
    });

    if (footer && isElementInViewport(footer)) {
        currentElement = footer;
    }

    if (!currentElement && footer) {
        const scrollPosition = window.scrollY + window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        if (scrollPosition >= documentHeight - 100) {
            currentElement = footer;
        }
    }

    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    if (currentElement) {
        const targetId = currentElement.getAttribute('id');
        const correspondingLink = document.querySelector(`.nav-link[href="#${targetId}"]`);

        if (correspondingLink) {
            correspondingLink.classList.add('active');
        }
    }
}

/**
 * Smooth scroll to section when navigation link is clicked
 */
function smoothScrollToSection(event) {
    event.preventDefault();

    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);

    if (targetElement) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const targetPosition = targetElement.offsetTop - headerHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

/**
 * Handle header styling on scroll (shrink/expand effect)
 */
function handleHeaderScroll() {
    const header = document.querySelector('.header');
    const logo = document.querySelector('.logo-img');
    const navLinks = document.querySelectorAll('.nav-link');

    if (!header || !logo) return;

    if (window.scrollY > 100) {
        header.style.padding = '0.5rem 0';
        header.style.backdropFilter = 'blur(15px)';
        header.style.boxShadow = '0 2px 15px rgba(0, 0, 0, 0.4)';

        logo.style.height = '80px';
        logo.style.transition = 'height 0.3s ease';

        navLinks.forEach(link => {
            link.style.fontSize = '18px';
            link.style.padding = '6px 14px';
            link.style.transition = 'all 0.3s ease';
        });
    } else {
        header.style.padding = '1rem 0';
        header.style.backdropFilter = 'blur(20px)';
        header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';

        logo.style.height = '120px';

        navLinks.forEach(link => {
            link.style.fontSize = '22px';
            link.style.padding = '8px 16px';
        });
    }
}

// ======================== MODAL GALLERY ========================

/**
 * Initialize modal image viewer for all product images
 */
function initModalGallery() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeModal = document.querySelector('.modal-close');

    if (!modal || !modalImg || !closeModal) return;

    // Close modal when clicking on X or outside the image
    closeModal.onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };

    // Add click event to all product images and thumbnails
    const allImages = document.querySelectorAll('.product-main-image img, .product-thumbnail');
    allImages.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал переход по карточке
            modal.style.display = 'flex';
            modalImg.src = img.src;
            modalImg.alt = img.alt || 'Tripalavina продукт';
        });
    });
}

// ======================== PRODUCT THUMBNAIL GALLERY ========================

/**
 * Initialize thumbnail gallery for each product card
 * Supports dynamic product cards (not just the first two)
 */
function initDynamicThumbnailGalleries() {
    const productCards = document.querySelectorAll('.product-showcase');

    productCards.forEach(card => {
        const mainImage = card.querySelector('.product-main-image img');
        const thumbnails = card.querySelectorAll('.product-thumbnail');

        if (!mainImage || thumbnails.length === 0) return;

        // Set first thumbnail as active if none is active
        const hasActive = Array.from(thumbnails).some(t => t.classList.contains('active'));
        if (!hasActive && thumbnails.length > 0) {
            thumbnails[0].classList.add('active');
        }

        thumbnails.forEach(thumbnail => {
            thumbnail.addEventListener('click', function (e) {
                e.stopPropagation(); // Останавливаем всплытие

                // Remove active class from all thumbnails in this card
                thumbnails.forEach(thumb => thumb.classList.remove('active'));

                // Add active class to clicked thumbnail
                this.classList.add('active');

                // Change main image
                const imagePath = this.getAttribute('data-image') || this.src;
                if (imagePath) {
                    // Fade animation
                    mainImage.style.opacity = '0';
                    setTimeout(() => {
                        mainImage.src = imagePath;
                        mainImage.alt = this.alt || 'Tripalavina продукт';
                        mainImage.style.opacity = '1';
                    }, 150);
                }
            });
        });
    });
}

// ======================== CARD CLICK (REDIRECT) ========================

/**
 * Клик по карточке вне фото и миниатюр — переход на страницу товара, если задан data-detail-url.
 * Поддерживает Ctrl+Click и Cmd+Click для открытия в новой вкладке.
 * ВАЖНО: НЕ блокирует клики по фото и миниатюрам (они обрабатываются отдельно)
 */
function initCardRedirect() {
    const productCards = document.querySelectorAll('.product-showcase');

    productCards.forEach((card) => {
        // Эти элементы НЕ должны вызывать переход (на них свои обработчики)
        const excludedElements = card.querySelectorAll('.product-main-image, .product-thumbnails, .product-thumbnail, .product-main-image img');
        const detailUrl = card.dataset.detailUrl;

        if (!detailUrl) {
            card.style.cursor = 'default';
            return;
        }

        card.style.cursor = 'pointer';

        card.addEventListener('click', function (e) {
            // Проверяем, был ли клик на исключённых элементах (фото, миниатюры)
            let isExcluded = false;
            excludedElements.forEach(element => {
                if (element && element.contains(e.target)) {
                    isExcluded = true;
                }
            });

            // Если кликнули на фото или миниатюру — не переходим, даём сработать модалке/галерее
            if (isExcluded) {
                return;
            }

            // Открываем ссылку с учётом модификаторов
            if (e.ctrlKey || e.metaKey) {
                window.open(detailUrl, '_blank');
            } else if (e.shiftKey) {
                window.open(detailUrl, '_blank', 'width=1200,height=800');
            } else {
                window.location.href = detailUrl;
            }
        });
    });
}

// ======================== MISSING IMAGE HANDLER ========================

/**
 * Handle broken image links: другие расширения (.JPG, .jpeg, .JPEG), затем плейсхолдер.
 */
function initImageErrorHandler() {
    const allImages = document.querySelectorAll('.product-main-image img, .product-thumbnail');

    allImages.forEach(img => {
        img.onerror = function () {
            if (this.src.indexOf('placehold.co') !== -1) return;
            const u = this.src.split('?')[0];
            const stem = u.replace(/\.[^/.]+$/, '');
            const variants = ['.jpg', '.JPG', '.jpeg', '.JPEG'].map(ext => stem + ext);
            let next = Number(this.dataset.imgExtNext ?? NaN);
            if (Number.isNaN(next)) {
                const cur = variants.findIndex(v => v === u);
                next = cur < 0 ? 1 : cur + 1;
            }
            if (next < variants.length) {
                this.dataset.imgExtNext = String(next + 1);
                this.src = variants[next];
                return;
            }
            this.onerror = null;
            this.src = 'https://placehold.co/600x400/2c3e2f/ffffff?text=Tripalavina';
        };
    });
}

// ======================== PRODUCT CARD GENERATION ========================

/**
 * Номер файла в имени (1, 2, … или из imageSlots для пропусков в нумерации).
 */
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

/**
 * Фото: обычно static/{folder}/{внутренняя}/n.jpg; flat — static/{folder}/Префикс (n).jpg (стойки, панели в корне папки).
 */
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

/**
 * Каталог подгружается из products.json (те же поля, что раньше в массиве).
 * Главную страницу открывайте через локальный сервер, чтобы fetch сработал.
 */
let productCategories = [];

async function loadProductCategories() {
    const res = await fetch('products.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('products.json: ' + res.status);
    productCategories = await res.json();
}

/**
 * Generate all product cards dynamically
 */
function generateAllProductCards() {
    const productsGrid = document.querySelector('.gallery-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    if (!productCategories.length) {
        productsGrid.innerHTML =
            '<p class="section-title" style="grid-column:1/-1;text-align:center;opacity:0.85">' +
            'Не удалось загрузить каталог. Откройте сайт через локальный сервер (нужен файл products.json).</p>';
        return;
    }

    productCategories.forEach((product, idx) => {
        const thumbCount = productImageCount(product);
        const firstSrc = productImageUrl(product, 1);

        const card = document.createElement('div');
        card.className = 'gallery-item product-showcase';
        card.setAttribute('data-product-idx', String(idx));
        card.dataset.detailUrl = product.detailUrl || '';
        card.id = `product-${idx}`;

        const mainImageDiv = document.createElement('div');
        mainImageDiv.className = 'product-main-image';
        const mainImg = document.createElement('img');
        mainImg.alt = product.name;
        mainImg.loading = 'lazy';
        mainImg.src = firstSrc;
        mainImageDiv.appendChild(mainImg);

        const thumbnailsDiv = document.createElement('div');
        thumbnailsDiv.className = 'product-thumbnails';

        for (let i = 1; i <= thumbCount; i++) {
            const url = productImageUrl(product, i);
            const thumbImg = document.createElement('img');
            thumbImg.className = 'product-thumbnail';
            if (i === 1) thumbImg.classList.add('active');
            thumbImg.alt = `${product.name} — фото ${i}`;
            thumbImg.loading = 'lazy';
            thumbImg.src = url;
            thumbImg.setAttribute('data-image', url);
            thumbnailsDiv.appendChild(thumbImg);
        }

        const priceMainHtml = product.priceText != null
            ? `<span class="price">${product.priceText}</span>`
            : `<span class="price">${product.basePrice.toLocaleString('ru-RU')}₽</span>`;
        const badgeHtml = product.badge
            ? `<div class="price-badge">${product.badge}</div>`
            : '';

        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'gallery-overlay';
        overlayDiv.innerHTML = `
            <div class="product-header">
                <div class="product-header-content">
                    <h3>${escapeHtml(product.name)}</h3>
                    <div class="product-subtitle">${escapeHtml(product.subtitle)}</div>
                    <div class="product-description-short">${escapeHtml(product.desc)}</div>
                </div>
            </div>
            <div class="product-price">
                <div class="price-main">
                    ${priceMainHtml}
                </div>
                <span class="price-note">${escapeHtml(product.priceNote)}</span>
            </div>
            <div class="click-hint">Подробнее</div>
        `;

        card.appendChild(mainImageDiv);
        card.appendChild(thumbnailsDiv);
        card.appendChild(overlayDiv);
        productsGrid.appendChild(card);
    });
}

// Простая защита от XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// ======================== INITIALIZATION ========================

/**
 * Main initialization function
 */
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await loadProductCategories();
    } catch (e) {
        console.warn(e);
        productCategories = [];
    }

    generateAllProductCards();

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', smoothScrollToSection);
    });

    updateActiveNavLink();
    window.addEventListener('scroll', updateActiveNavLink);
    window.addEventListener('resize', updateActiveNavLink);

    const debouncedUpdateNav = debounce(updateActiveNavLink, 100);
    window.addEventListener('scroll', debouncedUpdateNav);

    handleHeaderScroll();
    window.addEventListener('scroll', handleHeaderScroll);

    // Инициализация после генерации карточек
    setTimeout(() => {
        initDynamicThumbnailGalleries(); // Переключение миниатюр
        initModalGallery();              // Открытие модалки при клике на фото
        initCardRedirect();              // Переход по карточке (кроме фото)
        initImageErrorHandler();         // Обработка битых изображений
    }, 100);
});