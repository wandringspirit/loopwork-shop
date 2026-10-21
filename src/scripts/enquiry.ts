import { whatsappLink } from '../lib/whatsapp';
import { clearErrorsOnInput, validate, type Rule } from './validation';

type EnquiryOptions = {
  rules: Rule[];
  message: (data: FormData) => string;
};

/** Contact and custom-order forms: check the fields, then open WhatsApp with the message ready to send. */
export function setupEnquiryForm(form: HTMLFormElement, { rules, message }: EnquiryOptions) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const statusLink = status?.querySelector<HTMLAnchorElement>('[data-status-link]');
  clearErrorsOnInput(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validate(form, rules)) return;

    const link = whatsappLink(message(new FormData(form)));
    window.open(link, '_blank', 'noopener');
    if (status && statusLink) {
      statusLink.href = link;
      status.hidden = false;
    }
  });
}
