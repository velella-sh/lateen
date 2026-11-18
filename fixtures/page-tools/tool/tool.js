const slot = document.querySelector("[data-page-tool]");
if (slot) {
  slot.innerHTML = '<label for="page-tool-value">Value</label><input id="page-tool-value"><p data-page-tool-out></p>';
  const input = slot.querySelector("input");
  const out = slot.querySelector("[data-page-tool-out]");
  input.addEventListener("input", () => {
    out.textContent = input.value;
  });
}
