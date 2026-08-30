const config = require('../config');

class SideEffectQueue {
  constructor() {
    this.jobs = [];
    this.isProcessing = false;
    this.history = []; // for diagnostics/monitoring
  }

  enqueue(taskName, payload, options = {}) {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskName,
      payload,
      maxRetries: options.maxRetries || 3,
      attempts: 0,
      status: 'pending',
      createdAt: new Date(),
      error: null
    };

    this.jobs.push(job);
    this.history.push(job);
    
    // Process asynchronously off the request path
    setImmediate(() => this.processNext());
    return job.id;
  }

  async processNext() {
    if (this.isProcessing || this.jobs.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.jobs.shift();

    while (job.attempts < job.maxRetries) {
      job.attempts += 1;
      job.status = 'running';

      try {
        await this.executeTask(job.taskName, job.payload);
        job.status = 'completed';
        job.completedAt = new Date();
        break;
      } catch (err) {
        job.error = err.message;
        console.error(`[BackgroundJob] Job ${job.id} (${job.taskName}) attempt ${job.attempts} failed: ${err.message}`);

        if (job.attempts >= job.maxRetries) {
          job.status = 'failed';
          job.failedAt = new Date();
          console.error(`[BackgroundJob ALERT] Job ${job.id} (${job.taskName}) permanently failed after ${job.maxRetries} retries. Payload:`, job.payload);
        } else {
          // Delay before next retry
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    this.isProcessing = false;

    // Process remaining jobs in queue
    if (this.jobs.length > 0) {
      setImmediate(() => this.processNext());
    }
  }

  async executeTask(taskName, payload) {
    if (taskName === 'SEND_CONFIRMATION_EMAIL') {
      if (config.SIDE_EFFECT_FAIL_MODE || payload.forceFail) {
        throw new Error('Simulated SMTP / Email service connection refused (503)');
      }
      // Simulate real email dispatch
      console.log(`[EmailService] Confirmation email sent to ${payload.email || 'visitor'} for widget ${payload.widgetTitle || payload.widgetId}`);
      return { sent: true };
    }

    if (taskName === 'TRIGGER_WEBHOOK') {
      if (config.SIDE_EFFECT_FAIL_MODE || payload.forceFail) {
        throw new Error('Simulated Webhook endpoint unreachable (500)');
      }
      console.log(`[WebhookService] Webhook triggered for submission ${payload.submissionId}`);
      return { triggered: true };
    }

    throw new Error(`Unknown background task: ${taskName}`);
  }
}

module.exports = new SideEffectQueue();
