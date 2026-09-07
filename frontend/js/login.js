document.addEventListener("DOMContentLoaded", () => {
  const slideshow = document.querySelector("[data-login-slideshow]");
  const images = window.VIZITOR_LOGIN_IMAGES || [];
  if (!slideshow || !images.length) return;

  images.forEach((source, index) => {
    const slide = document.createElement("div");
    slide.className = `login-slide${index === 0 ? " is-active" : ""}`;
    slide.style.backgroundImage = `url("${source}")`;
    slideshow.appendChild(slide);
  });

  if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const slides = [...slideshow.children];
  let active = 0;
  window.setInterval(() => {
    slides[active].classList.remove("is-active");
    active = (active + 1) % slides.length;
    slides[active].classList.add("is-active");
  }, 6500);
});
