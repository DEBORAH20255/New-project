const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("Missing REDIS_URL environment variable.");
}

const redis = new Redis(REDIS_URL);

function getOtpKey(email) {
  return `otp:${email}`;
}

exports.handler = async function (event) {
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
  } catch (e) {
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

  try {
    const storedOtp = await redis.get(getOtpKey(email));
    if (!storedOtp) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "OTP expired or not found" }),
      };
    }

    if (storedOtp !== otp) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid OTP" }),
      };
    }

    await redis.del(getOtpKey(email));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "OTP verified successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "production" ? undefined : error.message,
      }),
    };
  }
};