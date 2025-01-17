# lighthouse-automation

This script is to generate domcontentloaded, page load, and time to interaction. tools using lighthouse, headless browser with session jacking.

run:
``npm i``

# lighthouse-automation
run: ``node lighthouseAutomation.js``

# lighthouse-automation with credentials
go to website and login, select https://dev.sitesched.com
go to inspect, get the `mattAuthUser` and `mattAuthToken` and save to config.js

run: ``node lighthouseAutomationAuth.js``

# lighthouse-automation with credentials
saved to csv, and copied to sheet performance benchmark