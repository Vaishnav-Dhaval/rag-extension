import { DOM_SELECTORS } from './selectors';

export function insertReplyText(text: string): boolean {
  const composeBox = document.querySelector(DOM_SELECTORS.COMPOSE_TEXTAREA) as HTMLElement | null;

  if (!composeBox) {
    return false;
  }

  // Branch A: fallback for real textarea/input elements
  if (composeBox instanceof HTMLTextAreaElement || composeBox instanceof HTMLInputElement) {
    const descriptor = Object.getOwnPropertyDescriptor(composeBox.constructor.prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(composeBox, text);
      composeBox.dispatchEvent(new Event('input', { bubbles: true }));
      composeBox.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Branch B: primary path for contenteditable
  if (composeBox.contentEditable === 'true') {
    try {
      composeBox.focus();

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(composeBox);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const success = document.execCommand('insertText', false, text);
      if (success) {
        return true;
      }

      // Fallback: manual InputEvent dispatch if execCommand returns false
      const beforeInputEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true,
      });

      const notCanceled = composeBox.dispatchEvent(beforeInputEvent);
      if (notCanceled) {
        // Manually mutate if not canceled
        composeBox.textContent = text;

        const inputEvent = new InputEvent('input', {
          inputType: 'insertText',
          data: text,
          bubbles: true,
          composed: true,
        });

        composeBox.dispatchEvent(inputEvent);
        return true;
      }
    } catch (error) {
      console.error('Error inserting reply text:', error);
      return false;
    }
  }

  return false;
}
