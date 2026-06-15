(() => {
  const copyIcon = '<svg height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.75 0.5C1.7835 0.5 1 1.2835 1 2.25V9.75C1 10.7165 1.7835 11.5 2.75 11.5H3.75H4.5V10H3.75H2.75C2.61193 10 2.5 9.88807 2.5 9.75V2.25C2.5 2.11193 2.61193 2 2.75 2H8.25C8.38807 2 8.5 2.11193 8.5 2.25V3H10V2.25C10 1.2835 9.2165 0.5 8.25 0.5H2.75ZM7.75 4.5C6.7835 4.5 6 5.2835 6 6.25V13.75C6 14.7165 6.7835 15.5 7.75 15.5H13.25C14.2165 15.5 15 14.7165 15 13.75V6.25C15 5.2835 14.2165 4.5 13.25 4.5H7.75ZM7.5 6.25C7.5 6.11193 7.61193 6 7.75 6H13.25C13.3881 6 13.5 6.11193 13.5 6.25V13.75C13.5 13.8881 13.3881 14 13.25 14H7.75C7.61193 14 7.5 13.8881 7.5 13.75V6.25Z"/></svg>';
  const checkIcon = '<svg height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.5607 3.99999L15.0303 4.53032L6.23744 13.3232C5.55403 14.0066 4.44599 14.0066 3.76257 13.3232L4.2929 12.7929L3.76257 13.3232L0.969676 10.5303L0.439346 9.99999L1.50001 8.93933L2.03034 9.46966L4.82323 12.2626C4.92086 12.3602 5.07915 12.3602 5.17678 12.2626L13.9697 3.46966L14.5 2.93933L15.5607 3.99999Z"/></svg>';

  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const activeElement = document.activeElement;

    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      document.execCommand('copy');
    } finally {
      textarea.remove();
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus({ preventScroll: true });
      }
    }
  };

  const writeClipboard = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Some local/embedded browser shells block Clipboard API even after a user click.
      }
    }

    // document.execCommand('copy') can return false in embedded/automation shells even when
    // the copy action is accepted by a normal browser. Treat a non-throwing fallback as handled
    // so the interaction keeps the same copy -> checkmark feedback as the reference component.
    fallbackCopy(text);
    return true;
  };

  const setupCodeCopy = () => {
    const blocks = Array.from(document.querySelectorAll('.doc pre, .card pre'));
    blocks.forEach((pre) => {
      if (pre.dataset.copyReady === 'true') return;
      const code = pre.querySelector('code');
      if (!code) return;

      pre.dataset.copyReady = 'true';
      pre.classList.add('code-copy-block');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button';
      button.setAttribute('aria-label', '复制代码');
      button.setAttribute('title', '复制代码');
      button.innerHTML = `<span class="copy-icon">${copyIcon}</span><span class="check-icon">${checkIcon}</span>`;

      let timer = 0;
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = code.innerText.replace(/\n$/, '');
        window.clearTimeout(timer);
        try {
          await writeClipboard(text);
          pre.classList.add('is-copied');
          button.setAttribute('aria-label', '已复制');
          button.setAttribute('title', '已复制');
          timer = window.setTimeout(() => {
            pre.classList.remove('is-copied');
            button.setAttribute('aria-label', '复制代码');
            button.setAttribute('title', '复制代码');
          }, 2000);
        } catch {
          pre.classList.add('copy-failed');
          button.setAttribute('aria-label', '复制失败');
          button.setAttribute('title', '复制失败');
          timer = window.setTimeout(() => {
            pre.classList.remove('copy-failed');
            button.setAttribute('aria-label', '复制代码');
            button.setAttribute('title', '复制代码');
          }, 2000);
        }
      });

      pre.appendChild(button);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCodeCopy, { once: true });
  } else {
    setupCodeCopy();
  }
})();
