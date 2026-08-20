// Authentication logic for Symmetry Login

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const googleButton = document.getElementById("btnGoogle");

    if (loginForm) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault(); // Prevent the page from refreshing

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const rememberMe = document.getElementById("rememberMe").checked;

            console.log("Mock Sign In Event triggered:");
            console.log("Email:", email);
            console.log("Password:", password ? "••••••••" : "Empty");
            console.log("Remember for 30 days:", rememberMe);

            // Friendly alert showing the captured inputs
            alert(`Logging in as: ${email}\n(Remember Me: ${rememberMe ? 'Yes' : 'No'})\n\nThis is a local demonstration. The FastAPI backend connection will be added in a later step!`);
        });
    }

    if (googleButton) {
        googleButton.addEventListener("click", () => {
            console.log("Mock Sign In with Google triggered");
            alert("Signing in with Google...\n\nThis is a local demonstration. The Google OAuth configuration will be added later!");
        });
    }
});
