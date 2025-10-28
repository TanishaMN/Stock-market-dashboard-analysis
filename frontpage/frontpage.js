window.addEventListener('load', () => {
    // --- Front Page Element Selectors ---
    const splashScreen = document.getElementById('splash-screen');
    const darkModeToggles = document.querySelectorAll('#darkModeToggle');
    const keyFeaturesBtn = document.getElementById('keyFeaturesBtn');
    const flipContainer = document.querySelector('.flip-container');
    const introParagraph = document.getElementById('intro-paragraph');
    const keyFeaturesList = document.getElementById('key-features-list');

    // --- Global Theme (Dark/Light) ---
    // --- Global Theme (Dark/Light) ---
function toggleDarkMode() {
document.body.classList.toggle('light-mode');
setInitialButtonText();
}

darkModeToggles.forEach(button => {
button.addEventListener('click', toggleDarkMode);
});

const setInitialButtonText = () => {
const isLightMode = document.body.classList.contains('light-mode');
darkModeToggles.forEach(button => {
 // Using span to insert icons or styled text
 button.innerHTML = isLightMode 
 ? '<span>🌙 Dark Mode</span>' :'<span>☀️ Light Mode</span>';
});
};

    const isSystemDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!isSystemDarkMode) {
        document.body.classList.add('light-mode');
    }
    setInitialButtonText();
    
    // --- Key Features button functionality ---
    if (keyFeaturesBtn) {
        keyFeaturesBtn.addEventListener('click', () => {
            const isFlipped = flipContainer.classList.contains('flipped');
            if (!isFlipped) {
                flipContainer.classList.add('flipped');
                flipContainer.style.height = `${keyFeaturesList.offsetHeight}px`;
                keyFeaturesBtn.textContent = 'Back';
            } else {
                flipContainer.classList.remove('flipped');
                flipContainer.style.height = `${introParagraph.offsetHeight}px`;
                keyFeaturesBtn.textContent = 'Key Features';
            }
        });
    }

    // Set initial height on first load
    // This code was moved from the nested listener to here
    if (introParagraph) {
        const initialHeight = introParagraph.offsetHeight;
        flipContainer.style.height = `${initialHeight}px`;
    }

    // All sharing functionality has been removed as the button is no longer present.
});