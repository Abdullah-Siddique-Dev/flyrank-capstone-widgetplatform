(function () {
  'use strict';

  // 1. Identify script origin and parameters
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  if (!currentScript) return;

  const scriptUrl = new URL(currentScript.src, window.location.href);
  const backendOrigin = scriptUrl.origin;
  const widgetId = scriptUrl.searchParams.get('id') || currentScript.getAttribute('data-widget-id');

  if (!widgetId) {
    console.error('[LeadCaptureWidget] Error: Missing widget ID in script src or data-widget-id.');
    return;
  }

  // 2. Find or create mounting container
  let container = document.getElementById(`lead-capture-widget-${widgetId}`) ||
                  document.getElementById('lead-capture-widget') ||
                  document.querySelector(`[data-widget-id="${widgetId}"]`);

  if (!container) {
    container = document.createElement('div');
    container.id = `lead-capture-widget-${widgetId}`;
    container.className = 'lc-widget-root';
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  }

  // 3. Inject encapsulated styling
  const styleId = 'lc-widget-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .lc-widget-root {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        max-width: 440px;
        margin: 16px 0;
        box-sizing: border-box;
      }
      .lc-widget-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
      }
      .lc-widget-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: #0f172a;
      }
      .lc-widget-desc {
        font-size: 14px;
        color: #64748b;
        margin: 0 0 20px 0;
        line-height: 1.4;
      }
      .lc-widget-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .lc-field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .lc-label {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
      }
      .lc-input {
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .lc-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .lc-button {
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 6px;
      }
      .lc-button:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .lc-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .lc-alert {
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        margin-top: 14px;
        display: none;
      }
      .lc-alert-success {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      .lc-alert-error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
      .lc-hp-field {
        display: none !important;
        position: absolute;
        left: -9999px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 4. Fetch widget configuration
  container.innerHTML = `<div class="lc-widget-card" style="text-align:center; color:#64748b; font-size:13px;">Loading widget...</div>`;

  fetch(`${backendOrigin}/api/widgets/${widgetId}/config`)
    .then(res => {
      if (!res.ok) throw new Error(`Widget not found (status ${res.status})`);
      return res.json();
    })
    .then(data => {
      const widget = data.data;
      renderWidget(container, widget, backendOrigin);
    })
    .catch(err => {
      container.innerHTML = `<div class="lc-widget-card" style="color:#ef4444; font-size:13px;">Unable to load widget: ${err.message}</div>`;
    });

  // 5. Render Widget DOM & Form Handling
  function renderWidget(mountPoint, widget, apiBase) {
    const fields = Array.isArray(widget.formFields) ? widget.formFields : [];

    let fieldsHtml = '';
    fields.forEach(field => {
      const isRequired = field.required ? 'required' : '';
      const reqStar = field.required ? '<span style="color:#ef4444;">*</span>' : '';
      const inputType = field.type || 'text';
      
      fieldsHtml += `
        <div class="lc-field-group">
          <label class="lc-label" for="lc-f-${widget.id}-${field.name}">
            ${field.label || field.name} ${reqStar}
          </label>
          <input 
            type="${inputType}" 
            id="lc-f-${widget.id}-${field.name}" 
            name="${field.name}" 
            class="lc-input" 
            placeholder="${field.placeholder || ''}" 
            ${isRequired}
          />
        </div>
      `;
    });

    mountPoint.innerHTML = `
      <div class="lc-widget-card">
        <h3 class="lc-widget-title">${widget.title || 'Get in Touch'}</h3>
        ${widget.description ? `<p class="lc-widget-desc">${widget.description}</p>` : ''}
        <form class="lc-widget-form" id="lc-form-${widget.id}">
          <!-- Honeypot field for bot spam prevention -->
          <input type="text" name="_hp" class="lc-hp-field" tabindex="-1" autocomplete="off" />
          
          ${fieldsHtml}
          
          <button type="submit" class="lc-button" id="lc-btn-${widget.id}">
            <span class="lc-btn-text">${widget.buttonText || 'Submit'}</span>
          </button>
          
          <div class="lc-alert lc-alert-success" id="lc-success-${widget.id}"></div>
          <div class="lc-alert lc-alert-error" id="lc-error-${widget.id}"></div>
        </form>
      </div>
    `;

    const form = document.getElementById(`lc-form-${widget.id}`);
    const submitBtn = document.getElementById(`lc-btn-${widget.id}`);
    const btnText = submitBtn.querySelector('.lc-btn-text');
    const successAlert = document.getElementById(`lc-success-${widget.id}`);
    const errorAlert = document.getElementById(`lc-error-${widget.id}`);

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Reset messages
      successAlert.style.display = 'none';
      errorAlert.style.display = 'none';

      // Gather answers
      const formData = new FormData(form);
      const answers = {};
      let honeypotValue = '';

      for (const [key, value] of formData.entries()) {
        if (key === '_hp') {
          honeypotValue = value;
        } else {
          answers[key] = value.trim();
        }
      }

      // Disable button during submission
      submitBtn.disabled = true;
      const originalText = btnText.textContent;
      btnText.textContent = 'Submitting...';

      fetch(`${apiBase}/api/widgets/${widget.id}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers,
          _hp: honeypotValue
        })
      })
        .then(async res => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body.error || body.message || 'Submission failed');
          }
          return body;
        })
        .then(() => {
          form.reset();
          successAlert.textContent = '✓ Thank you! Your submission has been received.';
          successAlert.style.display = 'block';
        })
        .catch(err => {
          errorAlert.textContent = `Error: ${err.message}`;
          errorAlert.style.display = 'block';
        })
        .finally(() => {
          submitBtn.disabled = false;
          btnText.textContent = originalText;
        });
    });
  }
})();
