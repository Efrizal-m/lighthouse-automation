const { createObjectCsvWriter } = require('csv-writer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const fs = require('fs');

// CSV file path
const csvFilePath = 'lighthouse_results.csv';

// Initialize CSV writer
const csvWriter = createObjectCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'url', title: 'URL' },
    { id: 'domContentLoaded', title: 'DOMContentLoaded' },
    { id: 'load', title: 'Load' },
    { id: 'tti', title: 'TTI' },
    { id: 'created_at', title: 'Created At' }
  ],
  append: true // Enable appending to the file instead of replacing it
});

// Function to run Lighthouse
async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

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
    tti
  };
}

// Function to save results to CSV
async function saveResultsToCSV(url, domContentLoaded, load, tti) {
  const currentTime = new Date().toISOString();

  const record = {
    url,
    domContentLoaded,
    load,
    tti,
    created_at: currentTime
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

  for (let i = 0; i < runs; i++) {
    console.log(`Running Lighthouse test #${i + 1}...`);
    const data = await runLighthouse(url);

    // Accumulate the data
    if (data.domContentLoaded !== null) domContentLoadedTotal += data.domContentLoaded;
    if (data.load !== null) loadTotal += data.load;
    if (data.tti !== null) ttiTotal += data.tti;
  }

  // Calculate the average values
  const domContentLoadedAvg = domContentLoadedTotal / runs;
  const loadAvg = loadTotal / runs;
  const ttiAvg = ttiTotal / runs;

  // Save the average data to the CSV file
  await saveResultsToCSV(url, domContentLoadedAvg, loadAvg, ttiAvg);

  // Return the average data
  return {
    domContentLoaded: domContentLoadedAvg,
    load: loadAvg,
    tti: ttiAvg,
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
  'https://sitesched.com/home',
  'https://sitesched.com/features/delay-warning',
  'https://sitesched.com/features/extension-of-time',
  'https://sitesched.com/features/dynamic-monitoring',
  'https://sitesched.com/pricing',
  'https://sitesched.com/about',
  'https://sitesched.com/contact-us',
  'https://sitesched.com/login'
];

processMultipleUrls(urls)
  .then(() => {
    console.log('All URLs processed');
  })
  .catch((error) => {
    console.error('Error processing URLs:', error);
  });
