import { generateRequestId } from '@rag-extension/shared';
import type { ExtensionMessage } from '../types/messages';

type PopupState = 'loading' | 'idle' | 'generating' | 'success' | 'error' | 'no-target';

interface UIState {
  state: PopupState;
  sourceText: string | null;
  reply: string | null;
  error: { code: string; message: string } | null;
}

let uiState: UIState = {
  state: 'loading',
  sourceText: null,
  reply: null,
  error: null,
};

/**
 * Chrome only injects declared content scripts on navigations that happen after
 * the extension loads, so any tab opened beforehand (fresh install, extension
 * reload, or update) has no listener and `sendMessage` rejects with
 * "Receiving end does not exist". Probe first, then inject on demand.
 */
async function isContentScriptAlive(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'PING',
      requestId: generateRequestId(),
    } as ExtensionMessage);
    return true;
  } catch {
    return false;
  }
}

async function waitForContentScript(tabId: number): Promise<boolean> {
  // The injected stub loads the real module via a dynamic import, so the
  // listener registers a tick or two after executeScript resolves.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isContentScriptAlive(tabId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function ensureContentScript(tabId: number): Promise<void> {
  if (await isContentScriptAlive(tabId)) return;

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files || files.length === 0) {
    throw new Error('No content script is declared in the manifest.');
  }

  await chrome.scripting.executeScript({ target: { tabId }, files });

  if (!(await waitForContentScript(tabId))) {
    throw new Error('Content script was injected but never responded. Try reloading the X.com tab.');
  }
}

async function initializePopup(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !isValidHost(tab.url)) {
      uiState.state = 'no-target';
      render();
      return;
    }

    await ensureContentScript(tab.id);

    const requestId = generateRequestId();
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_COMPOSE_TEXT_REQUEST',
      requestId,
    } as ExtensionMessage)) as { sourceText: string | null };

    if (response.sourceText) {
      uiState.state = 'idle';
      uiState.sourceText = response.sourceText;
    } else {
      uiState.state = 'no-target';
    }
  } catch (error) {
    // Surface the real failure instead of collapsing it into "no-target",
    // which sends the user looking for the wrong problem.
    console.error('Error initializing popup:', error);
    uiState.state = 'error';
    uiState.error = {
      code: 'CONTENT_SCRIPT_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Could not reach the X.com page.',
    };
  }

  render();
}

function isValidHost(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('x.com') || url.includes('twitter.com');
}

async function handleGenerateClick(): Promise<void> {
  if (!uiState.sourceText) return;

  uiState.state = 'generating';
  uiState.error = null;
  uiState.reply = null;
  render();

  try {
    const requestId = generateRequestId();
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_REPLY_REQUEST',
      requestId,
      sourceText: uiState.sourceText,
    } as ExtensionMessage);

    if (response.type === 'GENERATE_REPLY_RESPONSE') {
      uiState.state = 'success';
      uiState.reply = response.reply;
      handleInsertReply(requestId, response.reply);
    } else if (response.type === 'GENERATE_REPLY_ERROR') {
      uiState.state = 'error';
      uiState.error = response.error;
    }
  } catch (error) {
    uiState.state = 'error';
    uiState.error = {
      code: 'EXTENSION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to generate reply',
    };
  }

  render();
}

async function handleInsertReply(requestId: string, reply: string): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_REPLY_REQUEST',
      requestId,
      text: reply,
    } as ExtensionMessage);
  } catch (error) {
    console.error('Error inserting reply:', error);
  }
}

function render(): void {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'popup-container';

  const header = document.createElement('h1');
  header.className = 'popup-header';
  header.textContent = 'AI Reply Composer';
  container.appendChild(header);

  const content = document.createElement('div');
  content.className = 'popup-content';

  switch (uiState.state) {
    case 'loading':
      content.innerHTML = '<p>Loading...</p>';
      break;

    case 'no-target':
      const noTargetAlert = document.createElement('div');
      noTargetAlert.className = 'alert alert-warning';
      noTargetAlert.innerHTML = '⚠ Open a reply on X.com to use this extension.';
      content.appendChild(noTargetAlert);
      break;

    case 'idle':
      const button = document.createElement('button');
      button.className = 'button button-primary';
      button.textContent = 'Generate Reply';
      button.addEventListener('click', handleGenerateClick);
      content.appendChild(button);
      break;

    case 'generating':
      const generatingButton = document.createElement('button');
      generatingButton.className = 'button button-primary';
      generatingButton.disabled = true;
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      generatingButton.appendChild(spinner);
      generatingButton.appendChild(document.createTextNode('Generating...'));
      content.appendChild(generatingButton);
      break;

    case 'success':
      const successAlert = document.createElement('div');
      successAlert.className = 'alert alert-success';
      successAlert.innerHTML = '✓ Reply inserted! Review and post on X.';
      content.appendChild(successAlert);

      if (uiState.reply) {
        const replyBox = document.createElement('div');
        replyBox.className = 'reply-text';
        replyBox.textContent = uiState.reply;
        content.appendChild(replyBox);
      }

      const newButton = document.createElement('button');
      newButton.className = 'button button-primary';
      newButton.textContent = 'Close';
      newButton.addEventListener('click', () => window.close());
      content.appendChild(newButton);
      break;

    case 'error':
      const errorAlert = document.createElement('div');
      errorAlert.className = 'alert alert-error';
      const errorMsg = uiState.error?.message || 'Unknown error';
      errorAlert.innerHTML = `⚠ ${errorMsg}`;
      content.appendChild(errorAlert);

      const retryButton = document.createElement('button');
      retryButton.className = 'button button-primary';
      retryButton.textContent = 'Try Again';
      retryButton.addEventListener('click', () => {
        uiState.state = 'idle';
        uiState.error = null;
        uiState.reply = null;
        render();
      });
      content.appendChild(retryButton);
      break;
  }

  container.appendChild(content);
  root.appendChild(container);
}

document.addEventListener('DOMContentLoaded', initializePopup);
