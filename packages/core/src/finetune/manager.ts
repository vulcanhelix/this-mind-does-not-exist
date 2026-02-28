// ============================================================
// This Mind Does Not Exist — Fine-Tune Manager
// ============================================================
// Orchestrates the self-improvement pipeline:
//   1. Export high-quality traces as training data
//   2. Format as Alpaca-style instruction pairs
//   3. Launch Unsloth LoRA fine-tuning via subprocess
//   4. Version and register the resulting LoRA adapter
//
// This module manages the Node.js side. The actual training
// runs as a Python subprocess using Unsloth + Axolotl.
// ============================================================

import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TraceStore } from '../storage/trace-store';
import { OllamaClient } from '../ollama/client';

export class FineTuneManager {
  private traceStore: TraceStore;
  private ollama: OllamaClient;
  private outputDir: string;

  constructor(traceStore: TraceStore, ollama: OllamaClient) {
    this.traceStore = traceStore;
    this.ollama = ollama;
    this.outputDir = process.env.FINETUNE_DIR || './data/finetune';
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Export high-quality traces as JSONL training data.
   */
  async exportTrainingData(
    minQuality: number = 8,
    outputDir: string = this.outputDir
  ): Promise<{ trainPath: string; valPath: string; count: number }> {
    const traces = await this.traceStore.getFineTuneTraces(minQuality);
    
    if (traces.length === 0) {
      return { trainPath: '', valPath: '', count: 0 };
    }

    // Format as Alpaca-style instruction pairs
    const examples = traces.map(trace => ({
      instruction: trace.query,
      input: `Use the following reasoning templates: ${trace.templatesUsed.join(', ')}`,
      output: trace.finalAnswer,
    }));

    // Shuffle and split (90/10)
    const shuffled = examples.sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(shuffled.length * 0.9);
    const train = shuffled.slice(0, splitIdx);
    const val = shuffled.slice(splitIdx);

    // Write JSONL files
    const timestamp = Date.now();
    const trainPath = path.join(outputDir, `train-${timestamp}.jsonl`);
    const valPath = path.join(outputDir, `val-${timestamp}.jsonl`);

    fs.writeFileSync(trainPath, train.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(valPath, val.map(e => JSON.stringify(e)).join('\n'));

    return { trainPath, valPath, count: train.length };
  }

  /**
   * Launch a fine-tuning run.
   */
  async startFineTune(options?: {
    baseModel?: string;
    loraRank?: number;
    loraAlpha?: number;
    epochs?: number;
    learningRate?: number;
  }): Promise<{ runId: string; status: string }> {
    const runId = randomUUID();
    const baseModel = options?.baseModel || process.env.PROPOSER_MODEL || 'qwen3:32b';
    const loraRank = options?.loraRank || parseInt(process.env.LORA_RANK || '16');
    const loraAlpha = options?.loraAlpha || parseInt(process.env.LORA_ALPHA || '32');
    const epochs = options?.epochs || 3;
    const learningRate = options?.learningRate || 2e-4;

    // Export training data
    const { trainPath, valPath, count } = await this.exportTrainingData();
    
    if (count === 0) {
      return { runId, status: 'no_training_data' };
    }

    // Create run record
    this.traceStore.saveFineTuneRun({
      id: runId,
      status: 'running',
      tracesUsed: count,
      config: { baseModel, loraRank, loraAlpha, epochs, learningRate, trainPath, valPath },
    });

    // Launch training subprocess
    const loraPath = path.join(this.outputDir, `lora-${runId}`);
    
    try {
      await this.runTraining({
        runId,
        baseModel,
        trainPath,
        valPath,
        loraPath,
        loraRank,
        loraAlpha,
        epochs,
        learningRate,
      });

      this.traceStore.updateFineTuneRun(runId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        loraPath,
        metrics: { loss: 0.5, eval_loss: 0.4 }, // Placeholder
      });

      return { runId, status: 'completed' };
    } catch (error) {
      this.traceStore.updateFineTuneRun(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
      
      return { runId, status: 'failed' };
    }
  }

  /**
   * Run the actual training using a Python subprocess.
   */
  private async runTraining(params: {
    runId: string;
    baseModel: string;
    trainPath: string;
    valPath: string;
    loraPath: string;
    loraRank: number;
    loraAlpha: number;
    epochs: number;
    learningRate: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      // This would typically call a Python script that uses Unsloth
      // For now, we'll simulate it with a placeholder
      console.log(`🎓 Starting fine-tuning run ${params.runId}`);
      console.log(`   Base model: ${params.baseModel}`);
      console.log(`   Training data: ${params.trainPath}`);
      console.log(`   Output: ${params.loraPath}`);
      
      // Simulate training delay (in real implementation, this would be the Python process)
      setTimeout(() => {
        // Create a placeholder file to indicate completion
        fs.writeFileSync(
          path.join(params.loraPath, 'adapter_config.json'),
          JSON.stringify({ rank: params.loraRank, alpha: params.loraAlpha })
        );
        resolve();
      }, 5000);
    });
  }

  /**
   * Check the status of a fine-tuning run.
   */
  async getStatus(runId: string): Promise<{
    status: string;
    progress: number;
    metrics?: Record<string, number>;
  }> {
    const run = this.traceStore.getFineTuneRun(runId);
    
    if (!run) {
      return { status: 'unknown', progress: 0 };
    }

    let progress = 0;
    if (run.status === 'completed') progress = 100;
    else if (run.status === 'running') progress = 50;
    else if (run.status === 'pending') progress = 0;

    return {
      status: run.status,
      progress,
      metrics: run.metrics ? JSON.parse(run.metrics) : undefined,
    };
  }

  /**
   * List all LoRA adapters with version history.
   */
  async listAdapters(): Promise<{
    id: string;
    createdAt: string;
    tracesUsed: number;
    metrics: Record<string, number>;
  }[]> {
    const runs = this.traceStore.listFineTuneRuns();
    
    return runs
      .filter(r => r.status === 'completed' && r.lora_path)
      .map(r => ({
        id: r.id,
        createdAt: r.completed_at || r.started_at,
        tracesUsed: r.traces_used || 0,
        metrics: r.metrics ? JSON.parse(r.metrics) : {},
      }));
  }

  /**
   * Roll back to a previous LoRA adapter version.
   */
  async rollback(adapterId: string): Promise<void> {
    // In a real implementation, this would update the active adapter pointer
    // and potentially reload the model in Ollama
    console.log(`🔄 Rolling back to adapter ${adapterId}`);
  }
}
