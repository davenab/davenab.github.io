// Shared: footer year, light/dark toggle, filter buttons.
(function(){
  var yr=document.getElementById("yr"); if(yr) yr.textContent=new Date().getFullYear();
  var root=document.documentElement;
  try{var t=localStorage.getItem("theme"); if(t) root.dataset.theme=t;}catch(e){}
  var tb=document.getElementById("theme");
  if(tb) tb.addEventListener("click",function(){
    var dark=root.dataset.theme?root.dataset.theme==="dark":matchMedia("(prefers-color-scheme:dark)").matches;
    root.dataset.theme=dark?"light":"dark";
    try{localStorage.setItem("theme",root.dataset.theme);}catch(e){}
  });
  // Filters: <div class="filters"><button data-f="all|x">  + cards with data-cat="x"
  document.querySelectorAll(".filters").forEach(function(group){
    var btns=group.querySelectorAll("button");
    btns.forEach(function(b){ b.addEventListener("click",function(){
      btns.forEach(function(x){x.setAttribute("aria-pressed",x===b);});
      var f=b.dataset.f;
      document.querySelectorAll("[data-cat]").forEach(function(c){ c.style.display=(f==="all"||c.dataset.cat===f)?"":"none"; });
    });});
  });
})();
