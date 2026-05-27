(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var scriptSrc = SCRIPT && SCRIPT.src ? SCRIPT.src : "";
  var origin = scriptSrc ? new URL(scriptSrc).origin : window.location.origin;

  var container =
    document.getElementById("etp-website-embed") ||
    (SCRIPT && SCRIPT.previousElementSibling && SCRIPT.previousElementSibling.id === "etp-website-embed"
      ? SCRIPT.previousElementSibling
      : null);

  if (!container) {
    container = document.createElement("div");
    container.id = "etp-website-embed";
    if (SCRIPT && SCRIPT.parentNode) {
      SCRIPT.parentNode.insertBefore(container, SCRIPT);
    } else {
      document.body.appendChild(container);
    }
  }

  container.style.width = "100%";
  container.style.maxWidth = "100%";
  container.style.margin = "0 auto";
  container.style.boxSizing = "border-box";

  var iframe = document.createElement("iframe");
  iframe.title = "E-Transporte.pro — Templates de Website";
  iframe.src = origin + "/embed/website";
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.style.width = "100%";
  iframe.style.maxWidth = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.minHeight = "400px";
  iframe.style.background = "transparent";
  iframe.style.overflow = "hidden";

  container.innerHTML = "";
  container.appendChild(iframe);

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "etp-website-embed-height") return;
    if (event.origin !== origin) return;
    var h = Number(event.data.height);
    if (!Number.isFinite(h) || h < 400) return;
    iframe.style.height = Math.min(Math.max(h, 400), 12000) + "px";
  });
})();
