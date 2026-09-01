document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_HOST = 'http://127.0.0.1:8000';
    
    // Updated to match router prefix="/users" [source: 12]
    const API_URLS = {
        verifyUser: (username, password) => `${BACKEND_HOST}/users/${encodeURIComponent(username)}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        createUser: (email, username, password) => `${BACKEND_HOST}/users/new?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    };

    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toRegisterLink = document.getElementById('to-register');
    const toLoginLink = document.getElementById('to-login');
    const authSubtitle = document.getElementById('auth-subtitle');
    const toastContainer = document.getElementById('toast-container');

    // Switch View to Registration Form
    if (toRegisterLink) {
        toRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authSubtitle.textContent = 'Register an account to get started';
        });
    }

    // Switch View to Login Form
    if (toLoginLink) {
        toLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authSubtitle.textContent = 'Sign in to access your chat sessions';
        });
    }

    // Handle Login / Verification
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();

            try {
                const res = await fetch(API_URLS.verifyUser(username, password));
                if (!res.ok) throw new Error(`Server returned status: ${res.status}`);
                
                const data = await res.json();
                const returnedContent = data.content;
                
                if (data.status === "success" && returnedContent !== false && returnedContent !== "False" && returnedContent !== null) {
                    showToast("Login successful! Redirecting...");
                    
                    localStorage.setItem('CURRENT_USER_ID', String(returnedContent));
                    localStorage.setItem('CURRENT_USERNAME', username);
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1200);
                } else {
                    showToast("Invalid Username or Password.", true);
                }
            } catch (error) {
                console.error(error);
                showToast("System login request failed.", true);
            }
        });
    }

    // Handle Registration
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value.trim();

            try {
                const res = await fetch(API_URLS.createUser(email, username, password), {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }
                });

                if (!res.ok) throw new Error(`Registration failed with status: ${res.status}`);

                const data = await res.json();

                if (data.status === "success") {
                    showToast("Account created successfully! Please sign in.");
                    registerForm.reset();
                    if (toLoginLink) toLoginLink.click();
                } else {
                    showToast("Failed to create account. User may already exist.", true);
                }
            } catch (error) {
                console.error(error);
                showToast("Registration network error.", true);
            }
        });
    }

    function showToast(message, isError = false) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (isError) toast.classList.add('error');
        toast.innerHTML = isError 
            ? `<i class="fa-solid fa-circle-exclamation"></i> ${message}`
            : `<i class="fa-solid fa-circle-check"></i> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
});