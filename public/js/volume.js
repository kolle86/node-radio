const { addStation } = require("radio-browser");

/**
 * Initializes volume settings from localStorage
 */
function initVolumeSettings() {
  const volumeRange = document.getElementById("volumeRange");

  if (localStorage.getItem("volume") !== null) {
    const savedVolume = localStorage.getItem("volume");
    radio.volume = parseFloat(savedVolume);
    volumeRange.value = savedVolume * 100;
    changeVolume(savedVolume * 100);
  } else {
    changeVolume(radio.volume * 100);
  }
}

/**
 * Change volume
 * @param {number} value - Volume value (0-100)
 */
function changeVolume(value) {
  radio.volume = value / 100;
  localStorage.setItem("volume", radio.volume);
  // Adjust icon accordingly
  let iconClass = "bi-volume-up";
  if (value === 0) {
    iconClass = "bi-volume-mute";
  } else if (value < 50) {
    iconClass = "bi-volume-down";
  }

  replaceVolumeIcon(iconClass);

  let volumeBar = document.getElementById("volumeProgress");
  volumeBar.style.width = value + "%";
}

/**
 * Replace volume icon
 * @param {string} newIcon - CSS class of the new icon
 */
function replaceVolumeIcon(newIcon) {
  const volumeIcon = document.getElementById("volume_icon");
  ["bi-volume-up", "bi-volume-down", "bi-volume-mute"].forEach((cls) => {
    if (volumeIcon.classList.contains(cls)) {
      volumeIcon.classList.replace(cls, newIcon);
    }
  });
}

/**
 * Toggle mute
 */
function mute() {
  const volumeRange = document.getElementById("volumeRange");
  radio.muted = !radio.muted;
  volumeRange.disabled = radio.muted;

  if (radio.muted) {
    replaceVolumeIcon("bi-volume-mute");
    document.getElementById("volumeProgress").classList.add("volume-disabled");
  } else {
    changeVolume(parseInt(radio.volume * 100));
    document
      .getElementById("volumeProgress")
      .classList.remove("volume-disabled");
  }
}
