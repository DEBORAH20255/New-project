// Polyfill fetch for Node < 18. Remove/comment this line if on Node 18+ (Netlify default).
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

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

  let email, otp;
  try {
    ({ email, otp } = JSON.parse(event.body));
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "Invalid JSON body" }),
    };
  }

  if (!email || !otp) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "Missing email or OTP" }),
    };
  }

  try {
    const storedOtp = await redis.get(getOtpKey(email));
    if (!storedOtp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: "OTP expired or not found" }),
      };
    }

    if (storedOtp !== otp) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "Invalid OTP" }),
      };
    }

    // Optionally, delete the OTP after successful verification to prevent reuse
    await redis.del(getOtpKey(email));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "OTP verified successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};