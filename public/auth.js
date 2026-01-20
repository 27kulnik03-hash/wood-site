// Check if we're on login or register page
const isLoginPage = window.location.pathname.includes('login');
const isRegisterPage = window.location.pathname.includes('register');

// Get form and message elements
const form = isLoginPage ? document.getElementById('loginForm') : document.getElementById('registerForm');
const messageDiv = document.getElementById('message');

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
    }
});

// Handle form submission
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        messageDiv.className = 'auth-message';
        messageDiv.textContent = '';
        messageDiv.style.display = 'none';
        
        // Get form data
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        try {
            let endpoint = '';
            if (isLoginPage) {
                endpoint = '/api/auth/login';
            } else if (isRegisterPage) {
                endpoint = '/api/auth/register';
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Success
                messageDiv.className = 'auth-message success';
                messageDiv.textContent = result.message || (isLoginPage ? 'Login successful!' : 'Registration successful!');
                messageDiv.style.display = 'block';
                
                // Redirect to home page after a short delay
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                // Error
                messageDiv.className = 'auth-message error';
                messageDiv.textContent = result.error || 'An error occurred. Please try again.';
                messageDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Form submission error:', error);
            messageDiv.className = 'auth-message error';
            messageDiv.textContent = 'Network error. Please check your connection and try again.';
            messageDiv.style.display = 'block';
        }
    });
}
