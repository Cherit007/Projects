"use strict";

document.addEventListener("DOMContentLoaded", function () {
  //==========================================
  // MOBILE MENU
  //=========================================

  document
    .querySelectorAll('#navbar-menu a[href^="#"]:not([href="#"])')
    .forEach(function (anchor) {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        let target = document.querySelector(this.getAttribute("href"));
        if (target) {
          window.scrollTo({
            top: target.offsetTop,
            behavior: "smooth",
          });
          if (
            window.getComputedStyle(document.querySelector(".navbar-toggle"))
              .display !== "none"
          ) {
            let toggle =
              this.closest(".container").querySelector(".navbar-toggle");
            if (toggle) toggle.click();
          }
        }
      });
    });

  //==========================================
  // ScrollUp
  //=========================================

  let scrollUp = document.getElementById("scrollUp");

  window.addEventListener("scroll", function () {
    if (window.pageYOffset > 600) {
      scrollUp.style.display = "block";
    } else {
      scrollUp.style.display = "none";
    }
  });

  scrollUp.addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  //==========================================
  // For fancybox active
  //=========================================

  // Note: Fancybox is a jQuery plugin. For vanilla JS, you'd need to use a different lightbox library or implement your own.

  //==========================================
  // Loading
  //=========================================

});

        
