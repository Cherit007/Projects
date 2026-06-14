#!/usr/bin/env node
/**
 * Batch-generate UI mockups via Gemini API and save to docs/design/mockups/.
 *
 * Requires: GEMINI_API_KEY in .env or environment
 * Install:  npm install @google/genai dotenv
 *
 * Usage:
 *   npm run design:mockups              # priority 1 only (setup + team entry)
 *   npm run design:mockups -- --priority=2
 *   npm run design:mockups -- --only=03-setup-home-mobile
 *   npm run design:mockups -- --force
 *   npm run design:mockups:dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  buildFullPrompt,
  ensureDir,
  fileExists,
  filterMockups,
  loadManifest,
  parseCliArgs,
  resolveOutputDir,
  sleep,
} from './mockupConstants.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const extractImageFromResponse = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        buffer: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }
  return null;
};

const pickExtension = (mimeType) => {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('webp')) return '.webp';
  return '.png';
};

const formatApiError = (error) => {
  const message = String(error?.message || error || '');
  const isQuotaZero = message.includes('limit: 0')
    || message.includes('free_tier_requests');
  if (isQuotaZero) {
    return [
      'Gemini API image generation is not on the free tier (quota limit: 0).',
      'This is normal for new API keys — not a bug in your account setup.',
      '',
      'Options:',
      '  1. FREE: Gemini web chat (image gen works in the browser)',
      '       npm run design:mockups:web:login',
      '       npm run design:mockups:web',
      '  2. FREE: Export prompts and paste manually',
      '       npm run design:prompts:export',
      '  3. PAID: Enable billing on Google AI / Cloud, then retry API',
      '       https://ai.google.dev/gemini-api/docs/rate-limits',
    ].join('\n');
  }
  return message;
};

const generateWithModel = async ({ ai, model, prompt, aspectRatio }) => {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        aspectRatio: aspectRatio || '9:16',
      },
    },
  });
  return extractImageFromResponse(response);
};

const run = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.priority && args.only.length === 0) {
    args.priority = 1;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey && !args.dryRun) {
    console.error('Missing GEMINI_API_KEY (or GOOGLE_API_KEY) in .env');
    console.error('Get a key: https://aistudio.google.com/apikey');
    console.error('Or use Gemini web UI: npm run design:mockups:web');
    process.exit(1);
  }

  const manifest = await loadManifest();
  const outputDir = resolveOutputDir(manifest);
  const mockups = filterMockups(manifest.mockups, args);
  const models = [
    args.model,
    manifest.defaultApiModel,
    ...(manifest.fallbackApiModels || []),
  ].filter(Boolean);
  const uniqueModels = [...new Set(models)];

  await ensureDir(outputDir);

  if (mockups.length === 0) {
    console.log('No mockups matched filters.');
    return;
  }

  console.log(`Output: ${outputDir}`);
  console.log(`Mockups: ${mockups.length} item(s)${args.dryRun ? ' (dry run)' : ''}`);

  let GoogleGenAI;
  if (!args.dryRun) {
    ({ GoogleGenAI } = await import('@google/genai'));
  }
  const ai = args.dryRun ? null : new GoogleGenAI({ apiKey });

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let sawFreeTierBlock = false;

  for (const mockup of mockups) {
    const outPath = path.join(outputDir, mockup.filename);
    const fullPrompt = buildFullPrompt(mockup);

    if (!args.force && await fileExists(outPath)) {
      console.log(`skip  ${mockup.filename} (exists)`);
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(`\n--- ${mockup.filename} (${mockup.aspectRatio}) ---\n${fullPrompt}\n`);
      ok += 1;
      continue;
    }

    process.stdout.write(`gen   ${mockup.filename} ... `);

    let saved = false;
    let lastError = null;

    for (const model of uniqueModels) {
      try {
        const image = await generateWithModel({
          ai,
          model,
          prompt: fullPrompt,
          aspectRatio: mockup.aspectRatio,
        });
        if (!image) {
          throw new Error('No image in response');
        }
        const ext = pickExtension(image.mimeType);
        const finalPath = ext === '.png'
          ? outPath
          : outPath.replace(/\.png$/i, ext);
        await fs.writeFile(finalPath, image.buffer);
        console.log(`ok (${model})`);
        saved = true;
        ok += 1;
        break;
      } catch (error) {
        lastError = error;
        const msg = String(error?.message || '');
        if (msg.includes('limit: 0') || msg.includes('free_tier_requests')) {
          sawFreeTierBlock = true;
        }
      }
    }

    if (!saved) {
      console.log('fail');
      console.error(`  ${formatApiError(lastError)}`);
      failed += 1;
      if (sawFreeTierBlock) break;
    }

    if (args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  console.log(`\nDone: ${ok} ok, ${skipped} skipped, ${failed} failed`);
  if (sawFreeTierBlock && ok === 0) {
    console.error('\nStopped early: API image quota unavailable on free tier. Use web mode instead.');
  }
  if (failed > 0) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
