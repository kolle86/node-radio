/**
 * Initializes the AudioMotion analyzer
 * @returns {Object} AudioMotion instance
 */
function initAudioMotion() {
    const analyzer = new AudioMotionAnalyzer(
        document.getElementById('visualizer'),
        {
            source: radio,
            height: 48,
            showScaleX: false,
            overlay: true,
            showBgColor: true,
            bgAlpha: 0,
            mode: getAudioMotionMode(),
        }
    );

    analyzer.registerGradient('myGradient', {
        colorStops: [{ color: '#6c757d' }]
    });

    const selectElement = document.getElementById("selectGradient");
    let savedGradient = localStorage.getItem("gradient") || "default";
    selectElement.value = savedGradient;
    if (savedGradient == "default") {
        savedGradient = "myGradient";
    }
    analyzer.setOptions({ gradient: savedGradient });


    // Load visualizer settings from localStorage
    if (localStorage.getItem("visualizer") === "0") {
        analyzer.toggleAnalyzer();
        document.getElementById("visualizer").style.visibility = "hidden";
        document.getElementById("visualizerCheck").checked = false;
    }

    return analyzer;
}

/**
 * Toggles visualizer on/off
 */
function toggleVisualizer() {
    audioMotion.toggleAnalyzer();
    const visualizer = document.getElementById("visualizer");
    const isVisible = getComputedStyle(visualizer).visibility === 'visible';

    visualizer.style.visibility = isVisible ? "hidden" : "visible";
    localStorage.setItem("visualizer", isVisible ? 0 : 1);
}


function changeGradient(gradient) {
    localStorage.setItem("gradient", gradient);
    if (gradient === "default") {
        audioMotion.setOptions({ gradient: 'myGradient' });
    } else {
        audioMotion.setOptions({ gradient: gradient });
    }
}

/**
 * Get AudioMotion mode
 * @returns {number} AudioMotion mode
 */
function getAudioMotionMode() {
    let mode = 12 - parseInt(window.innerWidth / 100);
    return Math.max(2, Math.min(6, mode));
}

/**
 * Handle window resize event
 */
function resizedWindowEvent() {
    const newMode = getAudioMotionMode();
    if (newMode !== audioMotion.getOptions().mode) {
        audioMotion.setOptions({ mode: newMode });
    }
}