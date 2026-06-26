(function(){
'use strict';
var ov=document.getElementById('psrMobileOverlay');
var nv=document.getElementById('psrMobileNav');
var hd=document.getElementById('psrHeader');
window.psrToggleMobile=function(){if(nv)nv.classList.toggle('open');if(ov)ov.classList.toggle('open');document.body.classList.toggle('nav-open');};
window.psrCloseMobile=function(){if(nv)nv.classList.remove('open');if(ov)ov.classList.remove('open');document.body.classList.remove('nav-open');};
if(hd){window.addEventListener('scroll',function(){hd.style.boxShadow=window.scrollY>10?'var(--shadow-md)':'none';});};
window.addEventListener('resize',function(){if(window.innerWidth>768)window.psrCloseMobile();});
})();
