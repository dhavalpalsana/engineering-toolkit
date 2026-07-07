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
      <form id="auth-modal-form">
        <div class="auth-form-group">
          <label for="auth-email">Email Address</label>
          <input type="email" id="auth-email" class="form-input" style="width:100%;" required placeholder="name@company.com">
        </div>
        <div class="auth-form-group" style="margin-bottom: 16px;">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" class="form-input" style="width:100%;" required placeholder="••••••••">
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
  
  let isSignUpMode = false;
  let currentUser = null;

  const openAuthModal = () => {
    if (!fb.isConfigured()) {
      alert("Database is currently running in local offline mode. Config keys are required in js/firebase.js to enable online logins.");
      return;
    }
    authErrorMsg.style.display = "none";
    authForm.reset();
    setMode(false);
    authModal.style.display = "flex";
  };

  const closeAuthModal = () => {
    authModal.style.display = "none";
  };

  const setMode = (isSignUp) => {
    isSignUpMode = isSignUp;
    if (isSignUpMode) {
      authTitle.textContent = "Create Account";
      authSubtitle.textContent = "Get started saving your projects online";
      authSubmitBtn.textContent = "Sign Up";
      authToggleText.textContent = "Already have an account?";
      authToggleLink.textContent = "Sign In";
    } else {
      authTitle.textContent = "Sign In";
      authSubtitle.textContent = "Save your engineering calculations securely";
      authSubmitBtn.textContent = "Sign In";
      authToggleText.textContent = "Don't have an account?";
      authToggleLink.textContent = "Sign Up";
    }
  };

  // Toggle Mode Event
  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    setMode(!isSignUpMode);
  });

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
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isSignUpMode ? "Registering..." : "Signing In...";

    try {
      let result;
      if (isSignUpMode) {
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
    } catch (err) {
      authErrorMsg.textContent = err.message || "An auth error occurred.";
      authErrorMsg.style.display = "block";
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isSignUpMode ? "Sign Up" : "Sign In";
    }
  });

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
