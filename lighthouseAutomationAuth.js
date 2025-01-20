const { createObjectCsvWriter } = require('csv-writer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const config = require("./config");

// CSV file path
const csvFilePath = 'lighthouse_auth_results.csv';

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

// Initialize CSV writer
const csvWriter = createObjectCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'url', title: 'URL' },
    { id: 'domContentLoaded', title: 'DOMContentLoaded' },
    { id: 'load', title: 'Load' },
    { id: 'tti', title: 'TTI' },
    { id: 'created_at', title: 'Created At' },
    { id: 'screenshot', title: 'Screenshot Path' },  // Added new column for screenshot path
  ],
  append: true // Enable appending to the file instead of replacing it
});

// Function to run Lighthouse with cookies and take screenshot
async function runLighthouseWithCookies(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  // Connect puppeteer to the launched Chrome instance
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`
  });

  // Get the page to set cookies
  const page = await browser.newPage();

  const cookies = [
    {
      name: 'mattAuthUser',
      value: config.mAuthUser,
      domain: 'dev.sitesched.com',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: '',
      expires: (new Date()).getTime() / 1000 + 3600
    },
    {
      name: 'mattAuthToken',
      value: config.mAuthToken,
      domain: 'dev.sitesched.com',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: '',
      expires: (new Date()).getTime() / 1000 + 3600
    }
  ];

  // Set cookies
  await page.setCookie(...cookies);

  await page.goto(url);

  // Take a screenshot
  const screenshotPath = path.join(screenshotsDir, `${new Date().toISOString()}.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  const options = {
    port: chrome.port,
    output: 'json',
  };

  const runnerResult = await lighthouse(url, options);

  const jsonData = runnerResult.lhr;

  const domContentLoaded = jsonData.audits['first-contentful-paint']?.numericValue || null;
  const load = jsonData.audits['largest-contentful-paint']?.numericValue || null;
  const tti = jsonData.audits['interactive']?.numericValue || null;

  await chrome.kill();

  return {
    domContentLoaded,
    load,
    tti,
    screenshotPath  // Return screenshot path
  };
}

// Function to save results to CSV
async function saveResultsToCSV(url, domContentLoaded, load, tti, screenshotPath) {
  const currentTime = new Date().toISOString();

  const record = {
    url,
    domContentLoaded,
    load,
    tti,
    created_at: currentTime,
    screenshot: screenshotPath  // Add screenshot path to CSV record
  };

  try {
    // Append the new record to the CSV file
    await csvWriter.writeRecords([record]);
    console.log('Data saved to CSV');
  } catch (error) {
    console.error('Error saving data to CSV:', error);
  }
}

// Function to get average metrics over multiple runs and store in CSV
async function getAverageMetrics(url, runs = 3) {
  let domContentLoadedTotal = 0;
  let loadTotal = 0;
  let ttiTotal = 0;
  let screenshotPath = '';

  for (let i = 0; i < runs; i++) {
    console.log(`Running Lighthouse test #${i + 1}...`);
    const data = await runLighthouseWithCookies(url);

    // Accumulate the data
    if (data.domContentLoaded !== null) domContentLoadedTotal += data.domContentLoaded;
    if (data.load !== null) loadTotal += data.load;
    if (data.tti !== null) ttiTotal += data.tti;

    // Keep the last screenshot path
    screenshotPath = data.screenshotPath;
  }

  // Calculate the average values
  const domContentLoadedAvg = domContentLoadedTotal / runs;
  const loadAvg = loadTotal / runs;
  const ttiAvg = ttiTotal / runs;

  // Save the average data to the CSV file
  await saveResultsToCSV(url, domContentLoadedAvg, loadAvg, ttiAvg, screenshotPath);

  // Return the average data
  return {
    domContentLoaded: domContentLoadedAvg,
    load: loadAvg,
    tti: ttiAvg,
    screenshot: screenshotPath  // Include the screenshot path in the return data
  };
}

// Function to handle multiple URLs concurrently
async function processMultipleUrls(urls) {
  for await (const url of urls) {
    console.log(`Processing URL: ${url}`);
    try {
      const data = await getAverageMetrics(url);
      console.log("Average Metrics Over 3 Runs: ", data);
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
    }
  }
}


//===============================================================//

const urls = [
  // 'https://sitesched.com/portal?source=/projects',
  // 'https://dev.sitesched.com/projects',
  // 'https://dev.sitesched.com/account/profile',
  'https://dev.sitesched.com/account/project-archived',
  // 'https://dev.sitesched.com/account/project-template',
  // 'https://dev.sitesched.com/account/task-stack',
  // 'https://dev.sitesched.com/projects/225c6410-c72d-4de7-8ab5-980e56b19c2b/overview',
  // 'https://dev.sitesched.com/projects/225c6410-c72d-4de7-8ab5-980e56b19c2b/progress',
  // 'https://dev.sitesched.com/projects/225c6410-c72d-4de7-8ab5-980e56b19c2b/time-extensions',
  // 'https://dev.sitesched.com/projects/225c6410-c72d-4de7-8ab5-980e56b19c2b/analytics',
  // 'https://dev.sitesched.com/projects/225c6410-c72d-4de7-8ab5-980e56b19c2b/weather-forecast'
];

processMultipleUrls(urls)
  .then(() => {
    console.log('All URLs processed');
  })
  .catch((error) => {
    console.error('Error processing URLs:', error);
  });
