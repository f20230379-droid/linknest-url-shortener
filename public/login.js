const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

function getClient() {
  if (!window.supabaseClient) {
    throw new Error("Supabase client is not ready yet.");
  }
  return window.supabaseClient;
}

async function handleLogin() {
  message.textContent = "";
  loginBtn.disabled = true;
  signupBtn.disabled = true;

  try {
    const supabase = getClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });

    if (error) throw error;

    message.style.color = "green";
    message.textContent = "Login successful. Redirecting...";
    window.location.href = "/";
  } catch (error) {
    message.style.color = "red";
    message.textContent = error.message || "Login failed.";
  } finally {
    loginBtn.disabled = false;
    signupBtn.disabled = false;
  }
}

async function handleSignup() {
  message.textContent = "";
  loginBtn.disabled = true;
  signupBtn.disabled = true;

  try {
    const supabase = getClient();
    const { data, error } = await supabase.auth.signUp({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });

    if (error) throw error;

    message.style.color = "green";
    message.textContent =
      data.session
        ? "Signup successful. Redirecting..."
        : "Signup successful. Check your email if confirmation is enabled.";

    if (data.session) {
      window.location.href = "/";
    }
  } catch (error) {
    message.style.color = "red";
    message.textContent = error.message || "Signup failed.";
  } finally {
    loginBtn.disabled = false;
    signupBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", handleLogin);
signupBtn.addEventListener("click", handleSignup);