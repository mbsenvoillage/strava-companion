

document.addEventListener('DOMContentLoaded', async () => {

    const startAuthButton = document.getElementById('startAuth');
    const messageDiv = document.getElementById('message');

    startAuthButton.addEventListener('click', () => {
        window.location.href = '/authorize';
    });
    // Check authorization status
    const response = await fetch('/authorization-status');
    const { isAuthorized } = await response.json();
    if (isAuthorized) {
        startAuthButton.style.display = 'none';
        messageDiv.textContent = 'Welcome to strava companion!';
    }

  

        // Check for success or error messages in the URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('message')) {
            messageDiv.textContent = urlParams.get('message');
        }
});
