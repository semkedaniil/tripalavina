function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    
    // Проверяем, что нижняя часть элемента пересекает порог экрана
    return (
        rect.bottom >= windowHeight * 0.7 &&
        rect.top <= windowHeight
    );
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const footer = document.querySelector('footer[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    let currentElement = null;
    
    // Проверяем секции
    sections.forEach(section => {
        if (isElementInViewport(section)) {
            currentElement = section;
        }
    });
    
    // Проверяем футер, если он имеет ID
    if (footer && isElementInViewport(footer)) {
        currentElement = footer;
    }
    
    // Дополнительная проверка для футера - если пользователь в конце страницы
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

document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', smoothScrollToSection);
    });
    updateActiveNavLink();
    window.addEventListener('scroll', updateActiveNavLink);
    window.addEventListener('resize', updateActiveNavLink);
    
    // Инициализируем галерею на главной странице
    initMainPageGallery();
});

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

const debouncedUpdateNav = debounce(updateActiveNavLink, 100);
window.addEventListener('scroll', debouncedUpdateNav);

// Функция для галереи на главной странице
function initMainPageGallery() {
    // Инициализируем первую карточку (стойки)
    const mainImage = document.querySelector('#main-product-image');
    const thumbnails = document.querySelectorAll('.gallery-item:first-child .product-thumbnails .product-thumbnail');
    
    if (mainImage && thumbnails.length) {
        thumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', function() {
                // Убираем активный класс у всех миниатюр в этой карточке
                thumbnails.forEach(thumb => thumb.classList.remove('active'));
                
                // Добавляем активный класс к выбранной миниатюре
                this.classList.add('active');
                
                // Меняем главное изображение
                const imagePath = this.getAttribute('data-image');
                if (imagePath) {
                    mainImage.src = imagePath;
                    mainImage.alt = this.alt;
                    
                    // Добавляем анимацию смены изображения
                    mainImage.style.opacity = '0';
                    setTimeout(() => {
                        mainImage.style.opacity = '1';
                    }, 150);
                }
            });
        });
    }
    
    // Инициализируем вторую карточку (панели)
    const mainPanelsImage = document.querySelector('#main-panels-image');
    const panelsThumbnails = document.querySelectorAll('.gallery-item:last-child .product-thumbnails .product-thumbnail');
    
    if (mainPanelsImage && panelsThumbnails.length) {
        panelsThumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', function() {
                // Убираем активный класс у всех миниатюр в этой карточке
                panelsThumbnails.forEach(thumb => thumb.classList.remove('active'));
                
                // Добавляем активный класс к выбранной миниатюре
                this.classList.add('active');
                
                // Меняем главное изображение
                const imagePath = this.getAttribute('data-image');
                if (imagePath) {
                    mainPanelsImage.src = imagePath;
                    mainPanelsImage.alt = this.alt;
                    
                    // Добавляем анимацию смены изображения
                    mainPanelsImage.style.opacity = '0';
                    setTimeout(() => {
                        mainPanelsImage.style.opacity = '1';
                    }, 150);
                }
            });
        });
    }
    
    // Добавляем обработчики кликов для перехода на страницы товаров
    const productCards = document.querySelectorAll('.product-showcase');
    
    productCards.forEach((card, index) => {
        // Исключаем клики по миниатюрам и главному изображению
        const clickableElements = card.querySelectorAll('.product-main-image, .product-thumbnails');
        
        card.addEventListener('click', function(e) {
            // Проверяем, что клик не по миниатюрам или главному изображению
            let isClickableElement = false;
            clickableElements.forEach(element => {
                if (element.contains(e.target)) {
                    isClickableElement = true;
                }
            });
            
            if (!isClickableElement) {
                // Определяем, на какую страницу переходить
                if (index === 0) {
                    // Первая карточка - стойки
                    window.location.href = 'stoyki.html';
                } else if (index === 1) {
                    // Вторая карточка - панели
                    window.location.href = 'paneli.html';
                }
            }
        });
        
        // Добавляем курсор-указатель для карточки
        card.style.cursor = 'pointer';
    });
}

// Функция для уменьшения хедера при скролле
function handleHeaderScroll() {
    const header = document.querySelector('.header');
    const logo = document.querySelector('.logo-img');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (window.scrollY > 100) {
        // Уменьшаем хедер при скролле
        header.style.padding = '0.5rem 0';
        header.style.backdropFilter = 'blur(15px)';
        header.style.boxShadow = '0 2px 15px rgba(0, 0, 0, 0.4)';
        
        // Уменьшаем логотип
        logo.style.height = '80px';
        logo.style.transition = 'height 0.3s ease';
        
        // Уменьшаем навигационные ссылки
        navLinks.forEach(link => {
            link.style.fontSize = '18px';
            link.style.padding = '6px 14px';
            link.style.transition = 'all 0.3s ease';
        });
    } else {
        // Возвращаем исходные размеры при возврате в начало страницы
        header.style.padding = '1rem 0';
        header.style.backdropFilter = 'blur(20px)';
        header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        
        // Возвращаем исходный размер логотипа
        logo.style.height = '120px';
        
        // Возвращаем исходные размеры навигационных ссылок
        navLinks.forEach(link => {
            link.style.fontSize = '22px';
            link.style.padding = '8px 16px';
        });
    }
}

// Добавляем обработчик события скролла
window.addEventListener('scroll', handleHeaderScroll);

// Вызываем функцию при загрузке страницы для установки начального состояния
document.addEventListener('DOMContentLoaded', handleHeaderScroll);
