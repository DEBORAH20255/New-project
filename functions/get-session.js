const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL;
const redis = new Redis(REDIS_URL);

function getSessionKey(token) {
  return `session:${token}`;
}

exports.handler = async function (event) {
  const cookie = event.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  const sessionToken = match ? match[1] : null;

  if (!sessionToken) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "No session cookie found" }),
    };
  }

  try {
    const email = await redis.get(getSessionKey(sessionToken));
    if (!email) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Invalid or expired session" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, email }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Error verifying session", error: err.message }),
    };
  }
};