#!/usr/bin/env node
/**
 * Generate public/climate-pipeline-reality-check.pdf from /resources/reality-check
 * using Playwright.
 *
 * Flow: astro build (sync) → astro preview (background) → poll until ready →
 * Chromium navigates with media=print → page.pdf → kill preview.
 *
 * Run: npm run reality:pdf
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const PORT = 14322;
const previewUrl = `http://localhost:${PORT}/resources/reality-check`;
const outputPath = path.join(projectRoot, 'public', 'climate-pipeline-reality-check.pdf');
const STARTUP_TIMEOUT_MS = 30_000;

function run(command, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            stdio: 'inherit',
            ...opts,
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

async function waitForServer(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { method: 'GET' });
            if (res.ok) return;
        } catch {
            // Not ready yet.
        }
        await sleep(250);
    }
    throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function main() {
    console.log('▸ Building Astro site...');
    await run('npx', ['astro', 'build']);

    console.log(`▸ Starting astro preview server on port ${PORT}...`);
    const preview = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
        cwd: projectRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: false,
    });

    let browser;
    let exitCode = 0;
    try {
        await waitForServer(previewUrl, STARTUP_TIMEOUT_MS);
        console.log('▸ Preview server ready, generating PDF...');

        browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(previewUrl, { waitUntil: 'networkidle' });
        await page.emulateMedia({ media: 'print' });

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
        });

        console.log(`✓ PDF written to ${path.relative(projectRoot, outputPath)}`);
    } catch (err) {
        exitCode = 1;
        console.error('✗ Failed to generate PDF:', err.message);
    } finally {
        if (browser) await browser.close().catch(() => {});
        if (preview.pid && !preview.killed) {
            preview.kill('SIGTERM');
            await sleep(500);
            if (!preview.killed) preview.kill('SIGKILL');
        }
    }

    process.exit(exitCode);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
