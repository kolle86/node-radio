/**
 * Initializes the Chromecast API when it becomes available
 * @param {boolean} isAvailable - Whether the Cast API is available
 */
window['__onGCastApiAvailable'] = function (isAvailable) {
    if (isAvailable) {
        setTimeout(() => {
            initializeCastApi();
        }, 1000)
    }
};

/**
 * Initializes the Cast API with configuration settings and sets up event listeners
 */
initializeCastApi = function () {
    cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: "835FA0CB",
        //receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });
    player = new cast.framework.RemotePlayer();
    playerController = new cast.framework.RemotePlayerController(player);
    playerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED, function () {
            if (player.isConnected) {
                chromeCastIsConnected = true;
                radio.pause();
                radio.onpause();
            } else {
                chromeCastIsConnected = false;
            }
            Object.assign(currentStation, { name: null, url: null, favicon: null, uuid: null });
            updateUI()
        });
    playerController.addEventListener(
        cast.framework.RemotePlayerEventType.PLAYER_STATE_CHANGED, function () {
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
        });

};

/**
 * Initiates playback on Chromecast device with current station
 */
function chromeCastPlay() {
    var castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    var mediaInfo = new chrome.cast.media.MediaInfo(currentStation.url, "audio/mp3");
    mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
    mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
    mediaInfo.metadata.title = currentStation.name;
    mediaInfo.metadata.images = [{ url: currentStation.favicon }];
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    castSession.loadMedia(request).then(
        function () {
            handleTrackInfo();
        },
        function (errorCode) { console.log('Error code: ' + errorCode); });
}
