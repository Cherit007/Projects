import WOW from "wowjs";
import counterUp from "counterup2";
import Isotope from "isotope-layout";

export const initializeScripts = () => {
  // Spinner
  setTimeout(() => {
    const spinner = document.getElementById("spinner");
    if (spinner) {
      spinner.classList.remove("show");
    }
  }, 1);

  // Initiate Wow.js
  new WOW.WOW().init();

  // Sticky Navbar
  const navbar = document.querySelector(".sticky-top");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      navbar.classList.add("shadow-sm");
      navbar.style.top = "0px";
    } else {
      navbar.classList.remove("shadow-sm");
      navbar.style.top = "-100px";
    }
  });

  // Back to Top Button
  const backToTop = document.querySelector(".back-to-top");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTop.style.display = "block";
    } else {
      backToTop.style.display = "none";
    }
  });
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Facts Counter
  const counters = document.querySelectorAll('[data-toggle="counter-up"]');
  counters.forEach((counter) => {
    counterUp(counter, {
      duration: 2000,
      delay: 10,
    });
  });

  // Portfolio Isotope and Filter
  const portfolioIsotope = new Isotope(".portfolio-container", {
    itemSelector: ".portfolio-item",
    layoutMode: "fitRows",
  });
  const filters = document.querySelectorAll("#portfolio-flters li");
  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      filters.forEach((f) => f.classList.remove("active"));
      filter.classList.add("active");
      portfolioIsotope.arrange({ filter: filter.getAttribute("data-filter") });
    });
  });
};