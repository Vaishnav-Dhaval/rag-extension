interface StoredRequest {
  requestId: string;
  status: 'success' | 'error';
  reply?: string;
  error?: { code: string; message: string };
  timestamp: number;
}

async function initializePage(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  const container = document.createElement('div');
  container.className = 'options-container';

  const header = document.createElement('h1');
  header.className = 'options-header';
  header.textContent = 'AI Reply Composer Diagnostics';
  container.appendChild(header);

  const lastRequestSection = document.createElement('div');
  lastRequestSection.className = 'section';

  const lastRequestTitle = document.createElement('h2');
  lastRequestTitle.className = 'section-title';
  lastRequestTitle.textContent = 'Last Request';
  lastRequestSection.appendChild(lastRequestTitle);

  try {
    const data = await chrome.storage.local.get(['lastRequest']);
    const lastRequest = data.lastRequest as StoredRequest | undefined;

    if (lastRequest) {
      const requestInfo = document.createElement('div');
      requestInfo.className = 'request-info';

      const statusDiv = document.createElement('div');
      const statusLabel = document.createElement('div');
      statusLabel.className = 'request-info-label';
      statusLabel.textContent = 'Status';
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge status-${lastRequest.status}`;
      statusBadge.textContent = lastRequest.status.toUpperCase();
      statusDiv.appendChild(statusLabel);
      statusDiv.appendChild(statusBadge);
      requestInfo.appendChild(statusDiv);

      const idDiv = document.createElement('div');
      const idLabel = document.createElement('div');
      idLabel.className = 'request-info-label';
      idLabel.textContent = 'Request ID';
      const idValue = document.createElement('div');
      idValue.className = 'request-info-value';
      idValue.textContent = lastRequest.requestId;
      idDiv.appendChild(idLabel);
      idDiv.appendChild(idValue);
      requestInfo.appendChild(idDiv);

      const timeDiv = document.createElement('div');
      const timeLabel = document.createElement('div');
      timeLabel.className = 'request-info-label';
      timeLabel.textContent = 'Timestamp';
      const timeValue = document.createElement('div');
      timeValue.className = 'request-info-value';
      timeValue.textContent = new Date(lastRequest.timestamp).toLocaleString();
      timeDiv.appendChild(timeLabel);
      timeDiv.appendChild(timeValue);
      requestInfo.appendChild(timeDiv);

      if (lastRequest.status === 'success' && lastRequest.reply) {
        const replyDiv = document.createElement('div');
        const replyLabel = document.createElement('div');
        replyLabel.className = 'request-info-label';
        replyLabel.textContent = 'Generated Reply';
        const replyValue = document.createElement('div');
        replyValue.className = 'request-info-value';
        replyValue.textContent = lastRequest.reply;
        replyDiv.appendChild(replyLabel);
        replyDiv.appendChild(replyValue);
        requestInfo.appendChild(replyDiv);
      } else if (lastRequest.status === 'error' && lastRequest.error) {
        const errorDiv = document.createElement('div');
        const errorLabel = document.createElement('div');
        errorLabel.className = 'request-info-label';
        errorLabel.textContent = 'Error';
        const errorValue = document.createElement('div');
        errorValue.className = 'request-info-value';
        errorValue.textContent = `${lastRequest.error.code}: ${lastRequest.error.message}`;
        errorDiv.appendChild(errorLabel);
        errorDiv.appendChild(errorValue);
        requestInfo.appendChild(errorDiv);
      }

      lastRequestSection.appendChild(requestInfo);
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No requests yet. Use the extension to generate a reply.';
      lastRequestSection.appendChild(emptyState);
    }
  } catch (error) {
    console.error('Error loading last request:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'empty-state';
    errorDiv.textContent = 'Error loading diagnostics.';
    lastRequestSection.appendChild(errorDiv);
  }

  container.appendChild(lastRequestSection);

  const versionDiv = document.createElement('div');
  versionDiv.className = 'version';
  versionDiv.textContent = 'AI Reply Composer v0.1.0';
  container.appendChild(versionDiv);

  root.appendChild(container);
}

document.addEventListener('DOMContentLoaded', initializePage);
