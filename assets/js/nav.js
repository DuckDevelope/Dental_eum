/**
 * 이음 기공소 — 글로벌 헤더/푸터 주입 스크립트
 * 모든 서브페이지에서 공통 사용
 */

(function () {
  'use strict';

  /* ============================================================
     UTILITIES
  ============================================================ */
  function isMainPage() {
    const path = window.location.pathname;
    return path === '/' || path.endsWith('/index.html') && !path.includes('/about/') &&
      !path.includes('/location/') && !path.includes('/board/') &&
      !path.includes('/qna/') && !path.includes('/contact/');
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/' || (path.endsWith('index.html') && path.split('/').length <= 2)) return 'main';
    if (path.includes('/about/')) return 'about';
    if (path.includes('/location/')) return 'location';
    if (path.includes('/board/')) return 'board';
    if (path.includes('/qna/')) return 'qna';
    if (path.includes('/contact/')) return 'contact';
    return 'main';
  }

  /* ============================================================
     HEADER HTML
  ============================================================ */
  function buildHeader(currentPage) {
    const navItems = [
      { key: 'main',     href: '/',           label: '메인' },
      { key: 'about',    href: '/about/',      label: '기업소개' },
      { key: 'location', href: '/location/',   label: '오시는 길' },
      { key: 'board',    href: '/board/',      label: '게시판' },
      { key: 'qna',      href: '/qna/',        label: 'Q&A' },
      { key: 'contact',  href: '/contact/',    label: '문의하기' },
    ];

    const navLinks = navItems.map(item => {
      const active = item.key === currentPage ? ' class="global-nav__link global-nav__link--active"' : ' class="global-nav__link"';
      return `<li><a href="${item.href}"${active}>${item.label}</a></li>`;
    }).join('\n          ');

    const isMain = currentPage === 'main';
    const headerClass = isMain ? 'global-nav global-nav--main' : 'global-nav global-nav--sub';

    return `
<header class="${headerClass}" id="globalNav" role="banner">
  <div class="global-nav__inner">
    <a href="/" class="global-nav__logo" aria-label="이음 기공소 홈으로">
      <span class="global-nav__logo-kr">이음 기공소</span>
      <span class="global-nav__logo-en">EUM DENTAL LABORATORY</span>
    </a>

    <nav class="global-nav__menu" id="globalNavMenu" aria-label="주 메뉴">
      <ul class="global-nav__list">
          ${navLinks}
      </ul>
    </nav>

    <button class="global-nav__hamburger hamburger" id="hamburger"
            aria-label="메뉴 열기/닫기" aria-expanded="false" aria-controls="globalNavMenu">
      <span class="hamburger__line"></span>
      <span class="hamburger__line"></span>
      <span class="hamburger__line"></span>
    </button>
  </div>
</header>`;
  }

  /* ============================================================
     FOOTER HTML
  ============================================================ */
  function buildFooter() {
    return `
<footer class="global-footer" id="globalFooter" role="contentinfo">
  <div class="global-footer__inner">
    <div class="global-footer__brand">
      <p class="global-footer__name">이음 기공소</p>
      <p class="global-footer__sub">EUM DENTAL LABORATORY</p>
    </div>

    <address class="global-footer__info">
      <p>소장 김규홍</p>
      <p>경기도 용인시 기흥구 중부대로 184, 힉스유타워 A동 523-2호</p>
      <p>
        <a href="tel:010-4007-2804">010-4007-2804</a>
        <span class="global-footer__sep">|</span>
        <a href="mailto:eumdentallab@gmail.com">eumdentallab@gmail.com</a>
      </p>
      <p class="global-footer__bank">
        국민은행 698937-01-016816
        <button class="global-footer__copy-btn" id="copyBankBtn"
                aria-label="계좌번호 복사" title="복사">복사</button>
      </p>
    </address>

    <p class="global-footer__copy">&copy; 2026 이음 기공소. All rights reserved.</p>
  </div>
</footer>`;
  }

  /* ============================================================
     INJECT INTO DOM
  ============================================================ */
  function inject() {
    const currentPage = getCurrentPage();

    // Header — prepend to body
    const headerEl = document.createElement('div');
    headerEl.innerHTML = buildHeader(currentPage).trim();
    const header = headerEl.firstElementChild;
    document.body.insertBefore(header, document.body.firstChild);

    // Footer — append to body
    const footerEl = document.createElement('div');
    footerEl.innerHTML = buildFooter().trim();
    const footer = footerEl.firstElementChild;
    document.body.appendChild(footer);
  }

  /* ============================================================
     HAMBURGER TOGGLE
  ============================================================ */
  function initHamburger() {
    const btn  = document.getElementById('hamburger');
    const menu = document.getElementById('globalNavMenu');
    if (!btn || !menu) return;

    // Default: closed
    menu.setAttribute('data-open', 'false');
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', () => {
      const isOpen = menu.getAttribute('data-open') === 'true';
      menu.setAttribute('data-open', String(!isOpen));
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.classList.toggle('hamburger--open', !isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.setAttribute('data-open', 'false');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('hamburger--open');
      }
    });
  }

  /* ============================================================
     BANK ACCOUNT COPY
  ============================================================ */
  function initCopyBtn() {
    const btn = document.getElementById('copyBankBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('698937-01-016816');
        btn.textContent = '복사됨!';
        setTimeout(() => { btn.textContent = '복사'; }, 2000);
      } catch {
        btn.textContent = '복사 실패';
        setTimeout(() => { btn.textContent = '복사'; }, 2000);
      }
    });
  }

  /* ============================================================
     SCROLL BEHAVIOR — sub-page nav scroll shadow
  ============================================================ */
  function initNavScroll() {
    const nav = document.getElementById('globalNav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('global-nav--scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ============================================================
     SUB-PAGE REVEAL — IntersectionObserver fade-up
     메인 페이지는 main.js 의 initReveals()가 처리하므로 skip.
     서브 페이지 (about/location/board/qna/contact)에서만 [data-reveal]을
     관찰하여 .is-visible 토글.
  ============================================================ */
  function initSubReveal() {
    if (isMainPage()) return;
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ============================================================
     ENTRY
  ============================================================ */
  function init() {
    inject();
    initHamburger();
    initCopyBtn();
    initNavScroll();
    initSubReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
