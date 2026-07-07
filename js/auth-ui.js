// Engineering Toolkit - Global Auth UI & Integration Manager for Firebase
document.addEventListener("DOMContentLoaded", () => {
  const fb = window.fbHelper;
  if (!fb) {
    console.error("Firebase helper not found.");
    return;
  }

  // Inject styles dynamically to keep integration self-contained
  const style = document.createElement("style");
  style.textContent = `
    /* ── Universal Auth Button – consistent across every page ── */
    #auth-btn {
      height: 36px !important;
      padding: 0 14px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: var(--bg-tertiary) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: var(--radius-md) !important;
      color: var(--text-secondary) !important;
      cursor: pointer !important;
      transition: all var(--transition-fast) !important;
      white-space: nowrap !important;
      font-family: var(--font-sans) !important;
      width: auto !important;
    }
    #auth-btn:hover {
      background: var(--bg-secondary) !important;
      color: var(--text-primary) !important;
      border-color: var(--text-muted) !important;
    }
    #auth-btn.signed-in {
      background: var(--accent-primary-glow) !important;
      border-color: var(--accent-primary) !important;
      color: var(--accent-primary) !important;
    }
    #auth-btn.signed-in:hover {
      background: var(--accent-primary) !important;
      color: #fff !important;
    }
    #auth-btn svg, #auth-btn i[data-lucide] {
      width: 15px !important;
      height: 15px !important;
      flex-shrink: 0 !important;
    }

    .auth-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: authFadeIn 0.2s ease-out;
    }

    .auth-modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      width: 100%;
      max-width: 380px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      padding: 24px;
      position: relative;
      animation: authSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .auth-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 24px;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      transition: color var(--transition-fast);
    }
    .auth-modal-close:hover {
      color: var(--text-primary);
    }
    .auth-modal-header {
      margin-bottom: 20px;
    }
    .auth-modal-header h3 {
      font-size: 18px;
      font-weight: 800;
      color: var(--text-primary);
    }
    .auth-modal-header p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .auth-form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .auth-form-group label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @keyframes authFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes authSlideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .auth-modal-content .form-input {
      width: 100%;
      border: 1px solid var(--border-color);
      background-color: var(--bg-interactive);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-family: var(--font-sans);
      font-size: 14px;
      color: var(--text-primary);
      outline: none;
      transition: border-color var(--transition-fast);
      box-sizing: border-box;
    }
    .auth-modal-content .form-input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px var(--accent-primary-glow);
    }
    .auth-modal-content .calc-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #3b82f6));
      border: none;
      border-radius: var(--radius-md);
      color: #fff;
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all var(--transition-normal);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .auth-modal-content .calc-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .auth-modal-content .calc-btn:active {
      transform: translateY(0);
    }
    .auth-modal-content #auth-google-btn {
      background: var(--bg-interactive) !important;
      border: 1px solid var(--border-color) !important;
      color: var(--text-primary) !important;
      box-shadow: none !important;
    }
    .auth-modal-content #auth-google-btn:hover {
      background: var(--bg-tertiary) !important;
      transform: translateY(-1px);
    }
    #auth-btn {
      border-radius: var(--radius-md) !important;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    #auth-btn.signed-in {
      background: var(--accent-primary-glow) !important;
      border-color: var(--accent-primary) !important;
      color: var(--accent-primary) !important;
    }
  `;
  document.head.appendChild(style);

  // Inject Modal HTML structure
  const modalDiv = document.createElement("div");
  modalDiv.id = "auth-modal";
  modalDiv.className = "auth-modal-overlay";
  modalDiv.style.display = "none";
  modalDiv.innerHTML = `
    <div class="auth-modal-content">
      <button class="auth-modal-close" id="auth-modal-close-btn">&times;</button>
      <div class="auth-modal-header">
        <h3 id="auth-modal-title">Sign In</h3>
        <p id="auth-modal-subtitle">Save your engineering calculations securely</p>
      </div>
      <div id="auth-google-container" style="margin-bottom:12px;">
        <button type="button" id="auth-google-btn" class="calc-btn" style="width:100%;margin-bottom:0;background:var(--bg-interactive);border:1px solid var(--border-color);color:var(--text-primary);display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all var(--transition-fast);">
          <svg viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0;">
            <g transform="matrix(1, 0, 0, 1, 0, 0)">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.08 3.57-5.14 3.57-8.73z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-4v3.1A12 12 0 0 0 12 24z"/>
              <path fill="#FBBC05" d="M5.27 14.29A7.18 7.18 0 0 1 4.88 12c0-.8.13-1.58.39-2.29v-3.1h-4A12 12 0 0 0 0 12c0 3.58 1.58 6.8 4.12 9.01l1.15-3.72z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.29 0 3.2 4.09 1.28 9.01l4 3.1c.95-2.85 3.6-4.96 6.72-4.96z"/>
            </g>
          </svg>
          Continue with Google
        </button>
        <div style="display:flex;align-items:center;margin:16px 0 12px 0;font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">
          <span style="flex:1;height:1px;background:var(--border-color);margin-right:8px;"></span>
          or
          <span style="flex:1;height:1px;background:var(--border-color);margin-left:8px;"></span>
        </div>
      </div>
      <form id="auth-modal-form">
        <div class="auth-form-group">
          <label for="auth-email">Email Address</label>
          <input type="email" id="auth-email" class="form-input" style="width:100%;" required placeholder="name@company.com">
        </div>
        <div class="auth-form-group" id="auth-password-group" style="margin-bottom: 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <label for="auth-password">Password</label>
            <a href="#" id="auth-forgot-link" style="font-size:11px;color:var(--accent-primary);text-decoration:none;font-weight:700;">Forgot?</a>
          </div>
          <input type="password" id="auth-password" class="form-input" style="width:100%;margin-top:4px;" placeholder="••••••••">
        </div>
        <div id="auth-error-msg" style="color:var(--color-error);font-size:11px;font-weight:600;margin-bottom:12px;display:none;"></div>
        <button type="submit" class="calc-btn" id="auth-submit-btn" style="width:100%;margin-top:4px;">Sign In</button>
      </form>
      <div class="auth-modal-footer" style="margin-top: 16px; text-align: center; font-size: 12px; color: var(--text-muted);">
        <span id="auth-toggle-text">Don't have an account?</span>
        <a href="#" id="auth-toggle-link" style="color:var(--accent-primary);font-weight:700;text-decoration:none;margin-left:4px;">Sign Up</a>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);

  // DOM elements binding
  const authModal = document.getElementById("auth-modal");
  const authForm = document.getElementById("auth-modal-form");
  const authTitle = document.getElementById("auth-modal-title");
  const authSubtitle = document.getElementById("auth-modal-subtitle");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const authErrorMsg = document.getElementById("auth-error-msg");
  const authToggleText = document.getElementById("auth-toggle-text");
  const authToggleLink = document.getElementById("auth-toggle-link");
  const authCloseBtn = document.getElementById("auth-modal-close-btn");
  const authGoogleBtn = document.getElementById("auth-google-btn");
  const authGoogleContainer = document.getElementById("auth-google-container");
  const authPasswordGroup = document.getElementById("auth-password-group");
  const authForgotLink = document.getElementById("auth-forgot-link");
  const authPasswordInput = document.getElementById("auth-password");
  
  let authMode = "signin"; // "signin", "signup", "forgot"
  let currentUser = null;

  const openAuthModal = () => {
    if (!fb.isConfigured()) {
      alert("Database is currently running in local offline mode. Config keys are required in js/firebase.js to enable online logins.");
      return;
    }
    authErrorMsg.style.display = "none";
    authForm.reset();
    setMode("signin");
    authModal.style.display = "flex";
  };

  const closeAuthModal = () => {
    authModal.style.display = "none";
  };

  const setMode = (mode) => {
    authMode = mode;
    authErrorMsg.style.display = "none";
    authErrorMsg.style.color = "var(--color-error)"; // Reset color default

    if (authMode === "signup") {
      authTitle.textContent = "Create Account";
      authSubtitle.textContent = "Get started saving your projects online";
      authSubmitBtn.textContent = "Sign Up";
      authToggleText.textContent = "Already have an account?";
      authToggleLink.textContent = "Sign In";
      authPasswordGroup.style.display = "flex";
      authGoogleContainer.style.display = "block";
      authForgotLink.style.display = "none";
    } else if (authMode === "forgot") {
      authTitle.textContent = "Reset Password";
      authSubtitle.textContent = "We will email you a password recovery link";
      authSubmitBtn.textContent = "Send Reset Link";
      authToggleText.textContent = "Back to";
      authToggleLink.textContent = "Sign In";
      authPasswordGroup.style.display = "none";
      authGoogleContainer.style.display = "none";
    } else {
      // Default: "signin"
      authTitle.textContent = "Sign In";
      authSubtitle.textContent = "Save your engineering calculations securely";
      authSubmitBtn.textContent = "Sign In";
      authToggleText.textContent = "Don't have an account?";
      authToggleLink.textContent = "Sign Up";
      authPasswordGroup.style.display = "flex";
      authGoogleContainer.style.display = "block";
      authForgotLink.style.display = "inline";
    }
  };

  // Toggle Mode Event
  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (authMode === "signup" || authMode === "forgot") {
      setMode("signin");
    } else {
      setMode("signup");
    }
  });

  // Forgot Password click
  if (authForgotLink) {
    authForgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      setMode("forgot");
    });
  }

  // Modal interactions
  authCloseBtn.addEventListener("click", closeAuthModal);
  authModal.addEventListener("click", (e) => {
    if (e.target === authModal) closeAuthModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && authModal.style.display === "flex") closeAuthModal();
  });

  // Form Submit handler
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authErrorMsg.style.display = "none";
    authErrorMsg.style.color = "var(--color-error)"; // Default to error color
    
    const email = document.getElementById("auth-email").value;
    const password = authPasswordInput.value;

    if (authMode !== "forgot" && !password) {
      authErrorMsg.textContent = "Password is required.";
      authErrorMsg.style.display = "block";
      return;
    }

    authSubmitBtn.disabled = true;
    if (authMode === "forgot") {
      authSubmitBtn.textContent = "Sending...";
    } else if (authMode === "signup") {
      authSubmitBtn.textContent = "Registering...";
    } else {
      authSubmitBtn.textContent = "Signing In...";
    }

    try {
      if (authMode === "forgot") {
        const result = await fb.sendPasswordResetEmail(email);
        if (result.error) {
          authErrorMsg.textContent = result.error.message;
          authErrorMsg.style.display = "block";
        } else {
          authErrorMsg.style.color = "var(--color-success)";
          authErrorMsg.textContent = "Password reset email sent! Check your inbox.";
          authErrorMsg.style.display = "block";
          authForm.reset();
        }
      } else {
        let result;
        if (authMode === "signup") {
          result = await fb.signUp(email, password);
        } else {
          result = await fb.signIn(email, password);
        }

        if (result.error) {
          authErrorMsg.textContent = result.error.message;
          authErrorMsg.style.display = "block";
        } else {
          closeAuthModal();
        }
      }
    } catch (err) {
      authErrorMsg.textContent = err.message || "An auth error occurred.";
      authErrorMsg.style.display = "block";
    } finally {
      authSubmitBtn.disabled = false;
      if (authMode === "forgot") {
        authSubmitBtn.textContent = "Send Reset Link";
      } else if (authMode === "signup") {
        authSubmitBtn.textContent = "Sign Up";
      } else {
        authSubmitBtn.textContent = "Sign In";
      }
    }
  });

  // Google Sign-In click handler
  if (authGoogleBtn) {
    authGoogleBtn.addEventListener("click", async () => {
      authErrorMsg.style.display = "none";
      authErrorMsg.style.color = "var(--color-error)";
      authGoogleBtn.disabled = true;
      const originalHtml = authGoogleBtn.innerHTML;
      authGoogleBtn.innerHTML = "Connecting...";

      try {
        const result = await fb.signInWithGoogle();
        if (result.error) {
          authErrorMsg.textContent = result.error.message;
          authErrorMsg.style.display = "block";
        } else {
          closeAuthModal();
        }
      } catch (err) {
        authErrorMsg.textContent = err.message || "A Google sign-in error occurred.";
        authErrorMsg.style.display = "block";
      } finally {
        authGoogleBtn.disabled = false;
        authGoogleBtn.innerHTML = originalHtml;
      }
    });
  }

  // Global authentication button binder
  const updateAuthUIState = (user) => {
    currentUser = user;
    const authBtns = document.querySelectorAll("#auth-btn");
    const authTexts = document.querySelectorAll("#auth-btn-text");

    if (user) {
      const emailShort = user.email.split("@")[0];
      authTexts.forEach(el => el.textContent = `${emailShort} (Sign Out)`);
      authBtns.forEach(btn => {
        btn.title = `Signed in as ${user.email}. Click to sign out.`;
        btn.classList.add("signed-in");
      });
    } else {
      authTexts.forEach(el => el.textContent = "Sign In");
      authBtns.forEach(btn => {
        btn.title = "Sign In";
        btn.classList.remove("signed-in");
      });
    }
  };

  // Bind click listener to all matching buttons on the page
  document.body.addEventListener("click", async (e) => {
    const authBtn = e.target.closest("#auth-btn");
    if (authBtn) {
      e.preventDefault();
      if (currentUser) {
        if (confirm("Are you sure you want to sign out?")) {
          const { error } = await fb.signOut();
          if (error) alert("Sign out error: " + error.message);
        }
      } else {
        openAuthModal();
      }
    }
  });

  // Listen to auth changes
  if (fb.isConfigured()) {
    // Get initial session
    fb.getUser().then(user => {
      updateAuthUIState(user);
      document.dispatchEvent(new CustomEvent("auth-state-changed", { detail: { user } }));
    });

    // Listen for transitions
    fb.onAuthStateChange((user) => {
      updateAuthUIState(user);
      document.dispatchEvent(new CustomEvent("auth-state-changed", { detail: { user } }));
    });
  } else {
    // Local mode indicator
    updateAuthUIState(null);
  }
});
