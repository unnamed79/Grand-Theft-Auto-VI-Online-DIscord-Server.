(() => {
let timer=setTimeout(()=>document.documentElement.classList.add('page-loading'),800);
function done(){clearTimeout(timer);document.documentElement.classList.remove('page-loading');}
window.addEventListener('load',done,{once:true});window.addEventListener('pageshow',done);setTimeout(done,12000);
})();