/**
 * Initializes the Chromecast API when it becomes available
 * @param {boolean} isAvailable - Whether the Cast API is available
 */
window["__onGCastApiAvailable"] = function (isAvailable) {
  if (isAvailable) {
    setTimeout(() => {
      initializeCastApi();
    }, 1000);
  }
};

/**
 * Initializes the Cast API with configuration settings and sets up event listeners
 */
initializeCastApi = function () {
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: "835FA0CB",
    //receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  player = new cast.framework.RemotePlayer();
  playerController = new cast.framework.RemotePlayerController(player);
  playerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    function () {
      if (player.isConnected) {
        chromeCastIsConnected = true;
        radio.pause();
        radio.onpause();
      } else {
        chromeCastIsConnected = false;
      }
      Object.assign(currentStation, {
        name: null,
        url: null,
        favicon: null,
        uuid: null,
      });
      updateUI();
    }
  );
  playerController.addEventListener(
    cast.framework.RemotePlayerEventType.PLAYER_STATE_CHANGED,
    function () {
      chromeCastPlayerState = player.playerState;
      if (chromeCastPlayerState === "PLAYING") {
        setStatusIcon("bi-pause-circle");
        updateUI();
      } else if (chromeCastPlayerState === "PAUSED") {
        setStatusIcon("bi-play-circle");
        radio.onpause();
      } else if (chromeCastPlayerState === "BUFFERING") {
        setStatusIcon("spinner-border");
      }
    }
  );
};

/**
 * Initiates playback on Chromecast device with current station
 */
function chromeCastPlay() {
  var castSession =
    cast.framework.CastContext.getInstance().getCurrentSession();
  var mediaInfo = new chrome.cast.media.MediaInfo(
    currentStation.url,
    "audio/mp3"
  );
  mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
  mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
  mediaInfo.metadata.title = currentStation.name;

  // Ensure favicon URL is HTTPS and valid for Android notifications
  let faviconUrl = currentStation.favicon;
  if (faviconUrl) {
    // Convert HTTP to HTTPS for Android compatibility
    if (faviconUrl.startsWith("http://")) {
      faviconUrl = faviconUrl.replace("http://", "https://");
    }
    // Add multiple image sizes for better compatibility
    mediaInfo.metadata.images = [
      { url: faviconUrl, width: 512, height: 512 },
      { url: faviconUrl, width: 192, height: 192 },
      { url: faviconUrl, width: 128, height: 128 },
      { url: faviconUrl },
    ];
  } else {
    // Fallback to app icon if no favicon is available
    mediaInfo.metadata.images = [
      {
        url: window.location.origin + "/icons/512.png",
        width: 512,
        height: 512,
      },
      {
        url: window.location.origin + "/icons/192.png",
        width: 192,
        height: 192,
      },
    ];
  }

  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  castSession.loadMedia(request).then(
    function () {
      handleTrackInfo();
    },
    function (errorCode) {
      console.log("Error code: " + errorCode);
    }
  );
}
