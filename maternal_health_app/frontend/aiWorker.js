// WebWorker for Transformers.js
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Optimize environment for browser execution
env.allowLocalModels = false;
env.useBrowserCache = true; // Crucial for repeated visits

class AITriagePipeline {
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            // We use a zero-shot classification model.
            // nli-deberta-v3-xsmall is robust (~90MB) and highly accurate for text triage.
            this.instance = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall', {
                progress_callback
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    try {
        if (type === 'CLASSIFY') {
            const { text, labels } = payload;
            
            // Send loading status back to UI
            self.postMessage({ status: 'loading' });

            // Initialize or retrieve pipeline (this triggers the download if first time)
            let classifier = await AITriagePipeline.getInstance(x => {
                // Send download progress to main thread
                self.postMessage({ status: 'progress', data: x });
            });

            // Perform classification
            self.postMessage({ status: 'analyzing' });
            
            // Execute zeroshot classification
            const output = await classifier(text, labels, { multi_label: false });
            
            // Send final result back to main thread
            self.postMessage({ status: 'complete', result: output });
        }
    } catch (error) {
        self.postMessage({ status: 'error', error: error.message });
    }
});
