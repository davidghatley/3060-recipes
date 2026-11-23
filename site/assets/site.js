// Copy buttons: hidden without JavaScript, so the page reads complete either way.
document.querySelectorAll("[data-copy]").forEach((b) => {
  const pre = b.closest(".ss-code")?.querySelector("pre");
  if (!pre || !navigator.clipboard) return;
  b.hidden = false;
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.innerText.trim());
      b.textContent = "Copied";
    } catch {
      b.textContent = "Select and copy";
    }
    setTimeout(() => (b.textContent = "Copy"), 1600);
  });
});
