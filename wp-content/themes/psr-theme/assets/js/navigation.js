(function(){
'use strict';
var ov=document.getElementById('psrMobileOverlay');
var nv=document.getElementById('psrMobileNav');
var hd=document.getElementById('psrHeader');
// Стан доступності внутрішнього мобільного меню.
function setInternalMenuState(){var btn=document.querySelector('.mobile-menu-btn');if(btn&&nv)btn.setAttribute('aria-expanded',String(nv.classList.contains('open')));}

window.psrToggleMobile=function(){if(nv)nv.classList.toggle('open');if(ov)ov.classList.toggle('open');document.body.classList.toggle('nav-open');setInternalMenuState();};
window.psrCloseMobile=function(){if(nv)nv.classList.remove('open');if(ov)ov.classList.remove('open');document.body.classList.remove('nav-open');setInternalMenuState();};
if(hd){window.addEventListener('scroll',function(){hd.style.boxShadow=window.scrollY>10?'var(--shadow-md)':'none';});};
window.addEventListener('resize',function(){if(window.innerWidth>768)window.psrCloseMobile();});

// Мобільне меню головної: керування клавіатурою та коректний стан доступності.
var landingToggle = document.querySelector('.landing-menu-toggle');
var landingNav = document.getElementById('psrLandingNav');
if (landingToggle && landingNav) {
    document.body.classList.add('landing-nav-ready');
    function setLandingMenu(open, restoreFocus) {
        landingToggle.setAttribute('aria-expanded', String(open));
        landingNav.classList.toggle('is-open', open);
        if (restoreFocus) landingToggle.focus();
    }
    landingToggle.addEventListener('click', function () {
        setLandingMenu(landingToggle.getAttribute('aria-expanded') !== 'true', false);
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && landingToggle.getAttribute('aria-expanded') === 'true') {
            setLandingMenu(false, true);
        }
    });
    landingNav.addEventListener('click', function (event) {
        if (event.target.closest('a')) setLandingMenu(false, false);
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 900) setLandingMenu(false, false);
    });
}
})();
