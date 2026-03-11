// Slide-over panel for previewing tasks/projects without page navigation

let slideOverEl = null;

export function openSlideOver(title, bodyContent, footerContent = "") {
  closeSlideOver();
  slideOverEl = document.createElement("div");
  slideOverEl.className = "slide-over-backdrop";
  slideOverEl.innerHTML = `
    <div class="slide-over-panel">
      <div class="slide-over-header">
        <h3 class="slide-over-title">${title}</h3>
        <button class="slide-over-close">&times;</button>
      </div>
      <div class="slide-over-body">${bodyContent}</div>
      ${footerContent ? `<div class="slide-over-footer">${footerContent}</div>` : ""}
    </div>
  `;
  document.body.appendChild(slideOverEl);
  requestAnimationFrame(() => slideOverEl.classList.add("open"));

  slideOverEl.querySelector(".slide-over-close").addEventListener("click", closeSlideOver);
  slideOverEl.addEventListener("click", (e) => {
    if (e.target === slideOverEl) closeSlideOver();
  });
  document.addEventListener("keydown", handleEsc);
}

export function closeSlideOver() {
  if (!slideOverEl) return;
  document.removeEventListener("keydown", handleEsc);
  slideOverEl.classList.remove("open");
  const el = slideOverEl;
  slideOverEl = null;
  setTimeout(() => el?.remove(), 200);
}

export function getSlideOverBody() {
  return slideOverEl?.querySelector(".slide-over-body") ?? null;
}

function handleEsc(e) {
  if (e.key === "Escape") closeSlideOver();
}
