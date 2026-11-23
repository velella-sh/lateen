/// <reference lib="dom" />
import { writeClipboard } from "../../chrome/clipboard/result.ts";
import { brandCss, brandTokens, type Brand } from "../../src/brand-tokens.ts";
import { SYNTAX_MODES, syntaxColor } from "../../src/syntax-contrast.ts";
import { DEFAULT_PRESET, hex, optionsYaml, overridesOf, passesContrast, type Overrides } from "./model.ts";

function activate(root: HTMLElement, index: number): void {
  const form = root.querySelector("form");
  const sample = root.querySelector<HTMLElement>("[data-studio-preview]");
  const schemeControl = root.querySelector<HTMLElement>("[data-studio-scheme-control]");
  const css = root.querySelector("style");
  const yaml = root.querySelector<HTMLElement>("[data-studio-yaml]");
  const feedback = root.querySelector<HTMLElement>("[data-studio-feedback]");
  const copy = root.querySelector<HTMLButtonElement>("[data-studio-copy]");
  const copyStatus = root.querySelector<HTMLElement>("[data-studio-copy-status]");
  const downloads = root.querySelector<HTMLElement>("[data-studio-downloads]");
  if (!form || !sample || !schemeControl || !css || !yaml || !feedback || !copy || !copyStatus || !downloads) return;

  // Preset data comes only from the build. URL and form values can select from that data.
  const presets = JSON.parse(root.dataset.presets ?? "{}") as Record<string, Brand>;
  const initial = new URLSearchParams(location.search).get("preset");
  const fields = form.elements;
  const select = (name: string) => fields.namedItem(name) as HTMLSelectElement;
  const input = (name: string) => fields.namedItem(name) as HTMLInputElement;
  const preset = select("preset");
  const base = root.dataset.base ?? "";
  const selector = `[data-studio-instance="${index}"]`;
  const syntax = [...sample.querySelectorAll<HTMLElement>("[data-studio-syntax]")].flatMap((span) => {
    const [light, dark] = (span.dataset.studioSyntax ?? "").split(" ");
    return light && dark ? [{ span, pair: [light, dark] as const }] : [];
  });
  const originalSyntax = syntax.map(({ pair }) => pair);
  const roles = ["sans", "mono"] as const;
  const fontLinks = roles.map((role) => downloads.querySelector<HTMLElement>(`[data-studio-download="${role}"]`));
  let copyVersion = 0;

  function apply(): void {
    const selected = Object.hasOwn(presets, preset.value) ? presets[preset.value] : undefined;
    if (!selected) return;
    const values = {
      accent: input("accent").value,
      neutral: input("neutral").value,
      radius: select("radius").value,
      density: select("density").value,
      sans: select("sans").value,
      mono: select("mono").value,
    };
    const overrides = overridesOf(selected, values);
    copyVersion += 1;
    copyStatus!.textContent = "";
    for (const name of ["accent", "neutral"] as const) {
      const normalized = hex(values[name]);
      if (normalized === undefined) input(name).setAttribute("aria-invalid", "true");
      else {
        input(name).removeAttribute("aria-invalid");
        input(`${name}Picker`).value = normalized;
      }
    }
    if (overrides === undefined) {
      feedback!.textContent = "Enter a three- or six-digit hex color, such as #246.";
      copy!.disabled = true;
      return;
    }
    const { fonts, ...changes } = overrides;
    const brand = { ...selected, ...changes, ...fonts };
    if (!passesContrast(brand, originalSyntax)) {
      feedback!.textContent = "This combination does not pass contrast in both modes. Try a different color.";
      copy!.disabled = true;
      return;
    }

    sample!.dataset.studioInstance = String(index);
    css!.textContent = brandCss(brand, { base, selector });
    const tokens = brandTokens(brand);
    const backdrop = tokens["code-bg"];
    if (backdrop !== undefined) {
      for (const { span, pair } of syntax) {
        SYNTAX_MODES.forEach((mode, index) => span.style.setProperty(
          `--shiki-${mode}`, syntaxColor(pair[index] ?? "", backdrop[mode]),
        ));
      }
    }
    const accent = tokens["color-accent"];
    feedback!.textContent = accent !== undefined && (accent.light !== brand.accent || accent.dark !== brand.accent)
      ? `Contrast-adjusted accent. Light ${accent.light}, dark ${accent.dark}.`
      : "";
    yaml!.textContent = optionsYaml(preset.value, overrides);
    copy!.disabled = false;
    roleVisibility(fonts);
  }

  function roleVisibility(fonts: Overrides["fonts"]): void {
    const chosen = roles.map((role) => fonts?.[role] !== undefined);
    chosen.forEach((visible, index) => {
      const link = fontLinks[index];
      if (link) link.hidden = !visible;
    });
    downloads!.hidden = !chosen.some(Boolean);
  }

  function resetPreset(): void {
    const selected = presets[preset.value];
    if (!selected) return;
    input("accent").value = selected.accent ?? "";
    input("neutral").value = selected.neutral ?? "";
    select("radius").value = selected.radius ?? "";
    select("density").value = selected.density ?? "";
    apply();
  }

  if (initial && Object.hasOwn(presets, initial)) preset.value = initial;
  else preset.value = DEFAULT_PRESET;
  const modes = schemeControl.querySelectorAll<HTMLButtonElement>("[data-studio-scheme]");
  function showMode(mode: string) {
    sample!.dataset.scheme = mode;
    for (const button of modes) button.setAttribute("aria-pressed", String(button.dataset.studioScheme === mode));
  }
  showMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", (event) => {
    const field = event.target;
    if (field === preset) {
      resetPreset();
      return;
    }
    if (field instanceof HTMLInputElement && field.name.endsWith("Picker")) {
      input(field.name.slice(0, -6)).value = field.value;
    }
    apply();
  });
  for (const button of modes) {
    button.addEventListener("click", () => showMode(button.dataset.studioScheme ?? "light"));
  }
  copy.addEventListener("click", async () => {
    if (copy.disabled) return;
    const version = ++copyVersion;
    const ok = await writeClipboard(navigator.clipboard, yaml.textContent ?? "");
    if (version === copyVersion) copyStatus.textContent = ok ? "YAML copied." : "Select the YAML and copy it manually.";
  });

  resetPreset();
  form.hidden = false;
  schemeControl.hidden = false;
  copy.hidden = false;
}

if (typeof document !== "undefined") document.querySelectorAll<HTMLElement>("[data-brand-studio]").forEach(activate);
