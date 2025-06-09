/**
 * Sets up the Media Session handlers
 */
function setupMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.setActionHandler("play", () => {
    radio.load();
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    navigateStation(-1);
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    navigateStation(1);
  });
}

/**
 * Update Media Session Metadata
 */
function updateMediaSessionMetadata() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStation.name,
      artwork: [
        {
          src: currentStation.favicon,
          type: "image/png",
        },
      ],
    });
  }
}
