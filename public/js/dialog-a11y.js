/* Keyboard and focus behavior shared by the existing editor dialogs. */
(() => {
  let active = null;
  let returnFocus = null;
  let previousOverflow = "";
  const backgrounds = [
    ...document.querySelectorAll("body > header, body > main"),
  ];
  const backgroundState = new Map();
  const focusable = (modal) =>
    [
      ...modal.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      ),
    ].filter((el) => !el.closest(".hidden") && !el.hidden);
  function sync() {
    const open = [...document.querySelectorAll(".preview-modal")].find(
      (el) => !el.classList.contains("hidden"),
    );
    if (open === active) return;
    if (open) {
      if (!active) {
        returnFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;
        backgrounds.forEach((el) => {
          backgroundState.set(el, el.inert);
          el.inert = true;
        });
      }
      active = open;
      document.body.style.overflow = "hidden";
      const dialog = open.querySelector(".preview-dialog");
      dialog.tabIndex = -1;
      const first =
        open.id === "linkModal"
          ? open.querySelector("#linkText")
          : focusable(open)[0];
      (first || dialog).focus();
    } else {
      active = null;
      backgrounds.forEach((el) => {
        el.inert = backgroundState.get(el) || false;
      });
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null;
    }
  }
  document
    .querySelectorAll(".preview-modal")
    .forEach((modal) =>
      new MutationObserver(sync).observe(modal, {
        attributes: true,
        attributeFilter: ["class"],
      }),
    );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!active) return;
      if (event.key === "Escape") {
        event.preventDefault();
        active
          .querySelector(
            active.id === "linkModal"
              ? "#closeLinkButton"
              : "#closePreviewButton",
          )
          .click();
      } else if (event.key === "Tab") {
        const items = focusable(active);
        const first = items[0],
          last = items[items.length - 1];
        if (!items.length) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !items.includes(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !items.includes(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    true,
  );
  document.addEventListener("focusin", (event) => {
    if (active && !active.contains(event.target))
      (focusable(active)[0] || active.querySelector(".preview-dialog")).focus();
  });
})();
