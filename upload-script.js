/**
 * Batch upload script using Playwright
 * Uploads JPG images from local directory to the admin panel
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = 'D:\\liunx\\Pictures\\lr\\未命名导出';
const SITE_URL = 'https://web.265878.xyz/admin.html';
const PASSWORD = 'k423';
const UPLOAD_DELAY_MS = 2500; // delay between uploads to avoid rate limiting
const MAX_RETRIES = 2;

async function getJpgFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && /\.(jpg|jpeg)$/i.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function deduplicateByFilename(files) {
  const seen = new Set();
  const unique = [];
  for (const f of files) {
    const name = path.basename(f).toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(f);
    }
  }
  return unique;
}

function getTitleFromFilename(filePath) {
  return path.basename(filePath)
    .replace(/\.[^.]+$/, '')      // remove extension
    .replace(/[-_]/g, ' ')         // replace underscores/dashes with spaces
    .replace(/\s+/g, ' ')         // normalize spaces
    .trim();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadSingleImage(page, filePath, index, total) {
  const title = getTitleFromFilename(filePath);
  const fileName = path.basename(filePath);
  console.log(`[${index + 1}/${total}] Uploading: ${fileName} (title: "${title}")`);

  try {
    // Set file on the hidden file input
    const fileInput = await page.$('#fileInput');
    await fileInput.setInputFiles(filePath);

    // Wait for compression info to appear (means file was processed)
    await page.waitForSelector('.compress-info.show', { timeout: 30000 });
    console.log(`  -> File compressed`);

    // Wait for upload preview to appear
    await page.waitForSelector('.upload-preview.show', { timeout: 10000 });

    // Clear and set title
    const titleInput = await page.$('#photoTitle');
    await titleInput.fill('');
    await titleInput.fill(title);

    // Click upload button
    const uploadBtn = await page.$('#uploadBtn');
    await uploadBtn.click();

    // Wait for upload to complete - toast notification appears
    await page.waitForSelector('.toast.show', { timeout: 120000 });

    // Check if toast indicates success or error
    const toastText = await page.textContent('.toast.show');
    const toastClass = await page.getAttribute('.toast.show', 'class');

    if (toastClass.includes('error')) {
      throw new Error(`Upload failed: ${toastText}`);
    }

    console.log(`  -> Success: ${toastText}`);

    // Wait for toast to disappear
    await page.waitForFunction(() => {
      const toast = document.querySelector('.toast');
      return !toast || !toast.classList.contains('show');
    }, { timeout: 10000 });

    return true;
  } catch (err) {
    console.error(`  -> Error: ${err.message}`);

    // Try to reset the upload state
    try {
      const cancelBtn = await page.$('#cancelUpload');
      if (cancelBtn && await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await sleep(500);
      }
    } catch { /* ignore reset errors */ }

    return false;
  }
}

async function main() {
  console.log('=== Batch Image Upload Script ===\n');

  // 1. Find and deduplicate JPG files
  console.log('Scanning directory:', IMAGE_DIR);
  const allFiles = await getJpgFiles(IMAGE_DIR);
  console.log(`Found ${allFiles.length} JPG files`);

  const files = deduplicateByFilename(allFiles);
  console.log(`After dedup: ${files.length} unique files\n`);

  if (files.length === 0) {
    console.log('No files to upload. Exiting.');
    return;
  }

  // 2. Launch browser
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false, // set to true for silent mode, false to watch
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // 3. Navigate to admin page
    console.log('Navigating to admin page...');
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 4. Login
    console.log('Logging in...');
    await page.waitForSelector('#loginPassword', { state: 'visible', timeout: 15000 });
    await page.fill('#loginPassword', PASSWORD);
    await page.click('#loginBtn');

    // Wait for admin panel to become visible
    await page.waitForSelector('#adminPanel[style*="block"]', { timeout: 10000 });
    console.log('Login successful!\n');

    // 5. Upload each image
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (let i = 0; i < files.length; i++) {
      let success = false;
      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        if (retry > 0) {
          console.log(`  Retry ${retry}/${MAX_RETRIES}...`);
          await sleep(2000);
        }
        success = await uploadSingleImage(page, files[i], i, files.length);
        if (success) break;
      }

      results.push({ file: path.basename(files[i]), success });
      if (success) successCount++;
      else failCount++;

      // Delay between uploads
      if (i < files.length - 1) {
        await sleep(UPLOAD_DELAY_MS);
      }
    }

    // 6. Summary
    console.log('\n=== Upload Summary ===');
    console.log(`Total: ${files.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount > 0) {
      console.log('\nFailed files:');
      results.filter(r => !r.success).forEach(r => console.log(`  - ${r.file}`));
    }

  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    await browser.close();
    console.log('\nBrowser closed. Done.');
  }
}

main().catch(console.error);
