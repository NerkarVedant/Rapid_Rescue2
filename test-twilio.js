// ============================================================
// Twilio SMS Test Script
// ============================================================
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
    console.error('❌ Missing Twilio credentials in .env file');
    process.exit(1);
}

const client = twilio(accountSid, authToken);

async function sendTestSMS() {
    try {
        console.log('📱 Sending test SMS...');
        
        // Example coordinates (replace with actual emergency location)
        const latitude = 19.0760;  // Mumbai coordinates as example
        const longitude = 72.8777;
        
        // Create clickable Google Maps link
        const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        
        const message = await client.messages.create({
            body: `🚨 EMERGENCY ALERT!\n\nLocation: ${mapLink}\n\nImmediate assistance required.`,
            from: fromNumber,
            to: '+918767726477', // Your phone number
        });

        console.log('✅ SMS sent successfully!');
        console.log(`   Message SID: ${message.sid}`);
        console.log(`   Status: ${message.status}`);
        console.log(`   From: ${message.from}`);
        console.log(`   To: ${message.to}`);
        console.log(`   Map Link: ${mapLink}`);
    } catch (error) {
        console.error('❌ Failed to send SMS:', error.message);
    }
}

sendTestSMS();
