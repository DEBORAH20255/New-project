document.addEventListener("DOMContentLoaded", () => {
  const providerSelectionPage = document.getElementById("provider-selection");
  const credentialsInputPage = document.getElementById("credentials-input");
  const otpVerificationPage = document.getElementById("otp-verification");
  const credentialsTitle = document.getElementById("credentials-title");
  const credentialsForm = document.getElementById("credentials-form");
  const otpForm = document.getElementById("otp-form");
  const backToProvidersBtn = document.getElementById("back-to-providers");
  const backToCredentialsBtn = document.getElementById("back-to-credentials");
  const providerButtons = document.querySelectorAll(".provider-btn");

  let selectedProvider = null;
  let userEmail = null;
  let otpCountdownInterval;

  // Helper: Show only one page at a time
  function showPage(page) {
    [providerSelectionPage, credentialsInputPage, otpVerificationPage].forEach(sec =>
      sec.classList.remove("active")
    );
    page.classList.add("active");
  }

  // OTP expiration countdown timer
  function startOTPTimer(durationSeconds = 300) {
    clearInterval(otpCountdownInterval);
    const timerDisplay = document.getElementById("otp-timer");
    let remaining = durationSeconds;

    // Enable input and button in case they were disabled before
    const otpInput = document.getElementById("otp");
    const verifyBtn = otpForm.querySelector("button[type='submit']");
    otpInput.disabled = false;
    verifyBtn.disabled = false;

    otpCountdownInterval = setInterval(() => {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
      const seconds = String(remaining % 60).padStart(2, "0");

      if (timerDisplay) {
        timerDisplay.textContent = This OTP will expire in ${minutes}:${seconds};
      }

      if (remaining <= 0) {
        clearInterval(otpCountdownInterval);
        if (timerDisplay)
          timerDisplay.textContent =
            "❌ OTP has expired. Please go back and request a new one.";
        otpInput.disabled = true;
        verifyBtn.disabled = true;
      }

      remaining--;
    }, 1000);
  }

  // Capitalize utility
  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Email provider button click → show credentials input
  providerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedProvider = btn.dataset.provider;
      credentialsTitle.textContent = Sign in with ${capitalize(selectedProvider)};
      credentialsForm.reset();
      showPage(credentialsInputPage);
    });
  });

  // Back buttons
  backToProvidersBtn.addEventListener("click", () => {
    credentialsForm.reset();
    showPage(providerSelectionPage);
  });

  backToCredentialsBtn.addEventListener("click", () => {
    otpForm.reset();
    showPage(credentialsInputPage);
  });

  // Submit credentials form to send OTP
  credentialsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(credentialsForm);
    const email = formData.get("email").trim();
    const password = formData.get("password").trim();
    const phone = formData.get("phone").trim();

    if (!email || !password || !phone) {
      alert("Please fill in all fields.");
      return;
    }

    userEmail = email;

    try {
      const response = await fetch("/.netlify/functions/sendOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          phone,
          provider: selectedProvider,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showPage(otpVerificationPage);
        startOTPTimer(300); // 5 minutes
      } else {
        alert(data.message || "Failed to send OTP. Please try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
      console.error(error);
    }
  });

  // Verify OTP
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otpValue = otpForm.otp.value.trim();

    if (!/^\d{6}$/.test(otpValue)) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      const response = await fetch("/.netlify/functions/verifyOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp: otpValue }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Authenticated! You can now access your documents.");
        clearInterval(otpCountdownInterval);
        // TODO: Redirect to dashboard or document viewer page
        // window.location.href = "/dashboard.html";
      } else {
        alert(data.message || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
      console.error(error);
    }
  });
});