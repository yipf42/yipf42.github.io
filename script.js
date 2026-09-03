const body = document.body;
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const revealItems = document.querySelectorAll('.reveal');
const filterButtons = document.querySelectorAll('[data-filter]');
const workCards = document.querySelectorAll('.work-card');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxTitle = lightbox.querySelector('[data-lightbox-title]');
const lightboxMeta = lightbox.querySelector('[data-lightbox-meta]');
const lightboxCount = lightbox.querySelector('[data-lightbox-count]');
let activeLightboxItems = [];
let activeIndex = 0;

document.querySelector('[data-year]').textContent = new Date().getFullYear();

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  mobileMenu.setAttribute('aria-hidden', String(isOpen));
  mobileMenu.classList.toggle('is-open', !isOpen);
  body.classList.toggle('menu-open', !isOpen);
});

mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.classList.remove('is-open');
    body.classList.remove('menu-open');
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
    workCards.forEach((card) => {
      card.hidden = selected !== 'all' && card.dataset.category !== selected;
    });
  });
});

function visibleLightboxItems() {
  return [...document.querySelectorAll('[data-lightbox]')].filter((button) => {
    const card = button.closest('.work-card');
    return !card || !card.hidden;
  });
}

function renderLightbox(index) {
  activeIndex = (index + activeLightboxItems.length) % activeLightboxItems.length;
  const item = activeLightboxItems[activeIndex];
  lightboxImage.src = item.dataset.src;
  lightboxImage.alt = item.querySelector('img')?.alt || item.dataset.title;
  lightboxTitle.textContent = item.dataset.title;
  lightboxMeta.textContent = item.dataset.meta;
  lightboxCount.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(activeLightboxItems.length).padStart(2, '0')}`;
}

document.querySelectorAll('[data-lightbox]').forEach((button) => {
  button.addEventListener('click', () => {
    activeLightboxItems = button.closest('.work-card')
      ? [...document.querySelectorAll('.work-card:not([hidden]) [data-lightbox]')]
      : visibleLightboxItems();
    renderLightbox(activeLightboxItems.indexOf(button));
    lightbox.showModal();
    body.classList.add('lightbox-open');
  });
});

function closeLightbox() {
  lightbox.close();
  body.classList.remove('lightbox-open');
}

lightbox.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => renderLightbox(activeIndex - 1));
lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => renderLightbox(activeIndex + 1));
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
lightbox.addEventListener('close', () => body.classList.remove('lightbox-open'));
document.addEventListener('keydown', (event) => {
  if (!lightbox.open) return;
  if (event.key === 'ArrowLeft') renderLightbox(activeIndex - 1);
  if (event.key === 'ArrowRight') renderLightbox(activeIndex + 1);
});
