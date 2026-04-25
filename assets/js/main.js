/**
 * 이음 기공소 — v4 메인 스크립트 (영상 hero + 다크/라이트 교차 섹션)
 *
 * 박사님 결정 (2026-04-26): 아모레퍼시픽 톤으로 분위기 전환.
 *  • Hero: CAD 영상 풀스크린 자동재생 + grain·vignette overlay
 *  • 후속 섹션: 다크/라이트 교차, 스크롤 진입 시 fade-up reveal
 *  • 기존 frame sequence(v3.x)는 frames-hero.js / frames-hero.css로 보존
 *
 * 가벼운 책임만:
 *  - video autoplay 보조 (브라우저 차단 시 user gesture로 재시도)
 *  - IntersectionObserver 기반 섹션 reveal (.visible 토글)
 *  - hero scroll hint 페이드 (스크롤 시작 시 사라짐)
 *  - reduced-motion 대응
 */

(function () {
  'use strict';

  /* ============================================================
     CONFIG
  ============================================================ */
  const REVEAL_THRESHOLD = 0.12;
  const REVEAL_ROOT_MARGIN = '0px 0px -8% 0px';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     HERO VIDEO — autoplay 보조
  ============================================================ */
  function initHeroVideo() {
    const video = document.getElementById('heroVideo');
    if (!video) return;

    // reduced-motion: 영상 정지, poster 노출 유지
    if (reducedMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // 모바일 등 일부 브라우저는 첫 user gesture 후 재시도 필요
          const onceUserAct = () => {
            video.play().catch(() => {});
            window.removeEventListener('touchstart', onceUserAct);
            window.removeEventListener('click', onceUserAct);
          };
          window.addEventListener('touchstart', onceUserAct, { once: true, passive: true });
          window.addEventListener('click', onceUserAct, { once: true });
        });
      }
    };

    if (video.readyState >= 2) tryPlay();
    else video.addEventListener('canplay', tryPlay, { once: true });
  }

  /* ============================================================
     SECTION REVEAL — IntersectionObserver
  ============================================================ */
  function initReveals() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN });

    targets.forEach(el => io.observe(el));
  }

  /* ============================================================
     HERO SCROLL HINT — 스크롤 시작 시 페이드아웃
  ============================================================ */
  function initScrollHint() {
    const hint = document.querySelector('.hero__scroll-hint');
    if (!hint) return;

    let hidden = false;
    const onScroll = () => {
      if (!hidden && window.scrollY > 80) {
        hint.classList.add('is-hidden');
        hidden = true;
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ============================================================
     ENTRY
  ============================================================ */
  function init() {
    initHeroVideo();
    initReveals();
    initScrollHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
