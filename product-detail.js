(function () {
    let currentSlide = 0;
    let slides = [];
    let indicators = [];
    let thumbnails = [];

    function refreshRefs() {
        slides = document.querySelectorAll('.carousel-slide');
        indicators = document.querySelectorAll('.indicator');
        thumbnails = document.querySelectorAll('.thumbnail-gallery .thumbnail');
    }

    function changeSlide(direction) {
        refreshRefs();
        if (!slides.length) return;
        const newIndex = (currentSlide + direction + slides.length) % slides.length;
        goToSlide(newIndex);
    }

    function goToSlide(slideIndex) {
        refreshRefs();
        if (!slides.length || slideIndex < 0 || slideIndex >= slides.length) return;
        slides[currentSlide].classList.remove('active');
        if (indicators[currentSlide]) indicators[currentSlide].classList.remove('active');
        if (thumbnails[currentSlide]) thumbnails[currentSlide].classList.remove('active');
        currentSlide = slideIndex;
        slides[currentSlide].classList.add('active');
        if (indicators[currentSlide]) indicators[currentSlide].classList.add('active');
        if (thumbnails[currentSlide]) thumbnails[currentSlide].classList.add('active');
        updateModalIfOpen();
    }

    function updateModalIfOpen() {
        const modal = document.getElementById('imageModal');
        if (!modal || modal.style.display !== 'flex') return;
        refreshRefs();
        const modalImage = document.getElementById('modalImage');
        const modalIndicators = document.querySelectorAll('.modal-indicator');
        if (modalImage && slides[currentSlide]) {
            const img = slides[currentSlide].querySelector('img');
            if (img) modalImage.src = img.src;
        }
        modalIndicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentSlide);
        });
    }

    function openModal(imageSrc, slideIndex) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalIndicators = document.querySelectorAll('.modal-indicator');
        if (!modal || !modalImage) return;
        refreshRefs();
        currentSlide = slideIndex;
        modalImage.src = imageSrc;
        modalIndicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === slideIndex);
        });
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    function changeModalSlide(direction) {
        refreshRefs();
        if (!slides.length) return;
        const newIndex = (currentSlide + direction + slides.length) % slides.length;
        goToModalSlide(newIndex);
    }

    function goToModalSlide(slideIndex) {
        goToSlide(slideIndex);
    }

    window.changeSlide = changeSlide;
    window.goToSlide = goToSlide;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.changeModalSlide = changeModalSlide;
    window.goToModalSlide = goToModalSlide;

    document.addEventListener('DOMContentLoaded', function () {
        refreshRefs();
        currentSlide = 0;

        document.querySelectorAll('.carousel-slide img').forEach((img, index) => {
            img.addEventListener('click', function (e) {
                e.stopPropagation();
                const parentSlide = this.closest('.carousel-slide');
                if (parentSlide && parentSlide.classList.contains('active')) {
                    openModal(this.src, index);
                }
            });
        });

        document.querySelectorAll('.carousel-slide').forEach((slide, index) => {
            slide.addEventListener('click', function (e) {
                if (e.target === this && this.classList.contains('active')) {
                    const img = this.querySelector('img');
                    if (img) openModal(img.src, index);
                }
            });
        });

        document.querySelectorAll('.thumbnail-gallery .thumbnail').forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', function (e) {
                e.stopPropagation();
                goToSlide(index);
            });
        });

        document.querySelectorAll('.carousel-indicators .indicator').forEach((indicator, index) => {
            indicator.addEventListener('click', function () {
                goToSlide(index);
            });
        });

        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === this) closeModal();
            });
        }

        const header = document.querySelector('.header');
        const logo = document.querySelector('.logo-img');
        const navLinks = document.querySelectorAll('.nav-link');
        document.querySelectorAll('.carousel-slide img, .thumbnail-gallery img').forEach((img) => {
            img.addEventListener('error', function onDetailImgErr() {
                if (this.src.indexOf('placehold.co') !== -1) return;
                const u = this.src.split('?')[0];
                const stem = u.replace(/\.[^/.]+$/, '');
                const variants = ['.jpg', '.JPG', '.jpeg', '.JPEG'].map((ext) => stem + ext);
                let next = Number(this.dataset.imgExtNext ?? NaN);
                if (Number.isNaN(next)) {
                    const cur = variants.findIndex((v) => v === u);
                    next = cur < 0 ? 1 : cur + 1;
                }
                if (next < variants.length) {
                    this.dataset.imgExtNext = String(next + 1);
                    this.src = variants[next];
                    return;
                }
                this.removeEventListener('error', onDetailImgErr);
                this.src = 'https://placehold.co/600x400/2c3e2f/ffffff?text=Tripalavina';
            });
        });

        if (header && logo) {
            function handleHeaderScroll() {
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
            window.addEventListener('scroll', handleHeaderScroll);
            handleHeaderScroll();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
    });
})();
