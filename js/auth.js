// ===== AUTHENTICATION MODULE =====
(function () {
    'use strict';

    const SUPABASE_URL = 'https://jbkufpyyfmbxjeswagli.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia3VmcHl5Zm1ieGplc3dhZ2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MjgyMjYsImV4cCI6MjA4MzEwNDIyNn0.vmi9FErxUI2bZy_0vEqoCwoZ8RMgH7uRAtJ8QAhU8VY';

    // Wait for Supabase library
    if (typeof window.supabase === 'undefined') {
        console.error('[Auth] Supabase library not loaded');
        return;
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Auth state
    let currentUser = null;

    // Create login overlay
    function createLoginUI() {
        const overlay = document.createElement('div');
        overlay.id = 'authOverlay';
        overlay.innerHTML = `
      <div class="auth-container">
        <div class="auth-card glass-panel">
          <div class="auth-logo">d.</div>
          <h1 class="auth-title">dali's dashboard</h1>
          <p class="auth-subtitle">Sign in to sync your data across devices</p>
          
          <form id="authForm" class="auth-form">
            <input type="email" id="authEmail" class="auth-input" placeholder="Email address" required>
            <input type="password" id="authPassword" class="auth-input" placeholder="Password" required>
            <button type="submit" class="auth-btn" id="authSubmit">Sign In</button>
          </form>
          
          <div class="auth-toggle">
            <span id="authToggleText">Don't have an account?</span>
            <button type="button" class="auth-link" id="authToggle">Sign Up</button>
          </div>
          
          <div class="auth-divider"><span>or</span></div>
          
          <button type="button" class="auth-btn auth-btn-magic" id="authMagicLink">
            Send Magic Link
          </button>
          
          <p class="auth-message" id="authMessage"></p>
        </div>
      </div>
    `;
        document.body.insertBefore(overlay, document.body.firstChild);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
      #authOverlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.4s ease;
      }
      #authOverlay.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .auth-container {
        width: 100%;
        max-width: 400px;
        padding: 20px;
      }
      .auth-card {
        padding: 48px 40px;
        text-align: center;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 24px;
        backdrop-filter: blur(20px);
      }
      .auth-logo {
        width: 64px;
        height: 64px;
        margin: 0 auto 16px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 700;
        color: white;
      }
      .auth-title {
        font-size: 28px;
        font-weight: 600;
        color: white;
        margin: 0 0 8px;
      }
      .auth-subtitle {
        color: rgba(255,255,255,0.6);
        margin: 0 0 32px;
        font-size: 14px;
      }
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .auth-input {
        width: 100%;
        padding: 14px 18px;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
        transition: border-color 0.2s, background 0.2s;
        box-sizing: border-box;
      }
      .auth-input:focus {
        border-color: #667eea;
        background: rgba(255,255,255,0.08);
      }
      .auth-input::placeholder {
        color: rgba(255,255,255,0.4);
      }
      .auth-btn {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .auth-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
      }
      .auth-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      .auth-btn-magic {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.2);
      }
      .auth-btn-magic:hover {
        background: rgba(255,255,255,0.05);
        box-shadow: none;
      }
      .auth-toggle {
        margin-top: 24px;
        color: rgba(255,255,255,0.6);
        font-size: 14px;
      }
      .auth-link {
        background: none;
        border: none;
        color: #667eea;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        padding: 0;
        margin-left: 4px;
      }
      .auth-link:hover {
        text-decoration: underline;
      }
      .auth-divider {
        display: flex;
        align-items: center;
        margin: 24px 0;
        color: rgba(255,255,255,0.3);
        font-size: 12px;
      }
      .auth-divider::before,
      .auth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(255,255,255,0.1);
      }
      .auth-divider span {
        padding: 0 16px;
      }
      .auth-message {
        margin-top: 16px;
        font-size: 14px;
        color: #f87171;
        min-height: 20px;
      }
      .auth-message.success {
        color: #4ade80;
      }
    `;
        document.head.appendChild(style);

        // Event handlers
        let isSignUp = false;
        const form = document.getElementById('authForm');
        const emailInput = document.getElementById('authEmail');
        const passwordInput = document.getElementById('authPassword');
        const submitBtn = document.getElementById('authSubmit');
        const toggleBtn = document.getElementById('authToggle');
        const toggleText = document.getElementById('authToggleText');
        const magicLinkBtn = document.getElementById('authMagicLink');
        const messageEl = document.getElementById('authMessage');

        function showMessage(msg, isSuccess) {
            messageEl.textContent = msg;
            messageEl.className = 'auth-message' + (isSuccess ? ' success' : '');
        }

        toggleBtn.addEventListener('click', function () {
            isSignUp = !isSignUp;
            submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
            toggleText.textContent = isSignUp ? 'Already have an account?' : "Don't have an account?";
            toggleBtn.textContent = isSignUp ? 'Sign In' : 'Sign Up';
            showMessage('', false);
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showMessage('Please fill in all fields', false);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = isSignUp ? 'Creating account...' : 'Signing in...';

            try {
                let result;
                if (isSignUp) {
                    result = await supabase.auth.signUp({ email: email, password: password });
                } else {
                    result = await supabase.auth.signInWithPassword({ email: email, password: password });
                }

                if (result.error) {
                    showMessage(result.error.message, false);
                    submitBtn.disabled = false;
                    submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
                } else if (isSignUp && !result.data.session) {
                    showMessage('Check your email to confirm your account!', true);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign Up';
                }
                // If successful login, onAuthStateChange will handle hiding the overlay
            } catch (err) {
                showMessage('An error occurred. Please try again.', false);
                submitBtn.disabled = false;
                submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
            }
        });

        magicLinkBtn.addEventListener('click', async function () {
            const email = emailInput.value.trim();
            if (!email) {
                showMessage('Please enter your email first', false);
                return;
            }

            magicLinkBtn.disabled = true;
            magicLinkBtn.textContent = 'Sending...';

            try {
                const { error } = await supabase.auth.signInWithOtp({
                    email: email,
                    options: {
                        emailRedirectTo: window.location.origin + window.location.pathname
                    }
                });

                if (error) {
                    showMessage(error.message, false);
                } else {
                    showMessage('Magic link sent! Check your email.', true);
                }
            } catch (err) {
                showMessage('Failed to send magic link', false);
            }

            magicLinkBtn.disabled = false;
            magicLinkBtn.textContent = 'Send Magic Link';
        });
    }

    function hideLoginUI() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(function () {
                overlay.remove();
            }, 400);
        }
    }

    function showLoginUI() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(function (event, session) {
        console.log('[Auth] State change:', event);

        if (session && session.user) {
            currentUser = session.user;
            window.currentUserId = session.user.id;
            console.log('[Auth] User logged in:', session.user.email);
            hideLoginUI();

            // Trigger app initialization if it hasn't happened yet
            if (window.initDashboard && typeof window.initDashboard === 'function') {
                window.initDashboard();
            }
        } else {
            currentUser = null;
            window.currentUserId = null;
            console.log('[Auth] User logged out');
            showLoginUI();
        }
    });

    // Check initial session
    async function checkSession() {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            currentUser = data.session.user;
            window.currentUserId = data.session.user.id;
            console.log('[Auth] Existing session found:', data.session.user.email);
            hideLoginUI();
            return true;
        }
        return false;
    }

    // Initialize
    createLoginUI();

    // Export auth functions
    window.authModule = {
        getUser: function () { return currentUser; },
        getUserId: function () { return currentUser ? currentUser.id : null; },
        signOut: async function () {
            await supabase.auth.signOut();
            window.location.reload();
        },
        checkSession: checkSession
    };

    // Check for existing session
    checkSession();

})();
