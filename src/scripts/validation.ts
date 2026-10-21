export type Rule = {
  name: string;
  /** Returns an error message, or '' when the value is fine. Checkboxes pass 'yes' when ticked. */
  check: (value: string) => string;
};

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const isControl = (element: unknown): element is Control =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;

function showError(form: HTMLFormElement, control: Control, message: string) {
  if (message) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');
  const output = form.querySelector<HTMLElement>(`[data-error-for="${control.name}"]`);
  if (output) output.textContent = message;
}

/** Checks every rule, shows inline errors and focuses the first problem. Returns true when all pass. */
export function validate(form: HTMLFormElement, rules: Rule[]): boolean {
  let firstInvalid: Control | undefined;
  for (const rule of rules) {
    const control = form.elements.namedItem(rule.name);
    if (!isControl(control)) continue;
    const isCheckbox = control instanceof HTMLInputElement && control.type === 'checkbox';
    const value = isCheckbox ? (control.checked ? 'yes' : '') : control.value.trim();
    const message = rule.check(value);
    showError(form, control, message);
    if (message && !firstInvalid) firstInvalid = control;
  }
  firstInvalid?.focus();
  return firstInvalid === undefined;
}

/** Clears a field's error as soon as the customer starts fixing it. */
export function clearErrorsOnInput(form: HTMLFormElement) {
  const clear = (event: Event) => {
    const target = event.target;
    if (isControl(target) && target.hasAttribute('aria-invalid')) showError(form, target, '');
  };
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
}

/** Accepts 98765 43210, +91 98765 43210, 098765 43210… and returns "+91 98765 43210", or null. */
export function normaliseIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1);
  return /^[6-9]\d{9}$/.test(local) ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : null;
}

export const isValidPincode = (value: string) => /^[1-9]\d{5}$/.test(value);

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
