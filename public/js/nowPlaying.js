/**
 * Handle track information
 */
function handleTrackInfo() {
    const isActiveFav = document.getElementById(currentStation.uuid)?.classList.contains("fav");

    if ((!radio.paused && isActiveFav) || (chromeCastPlayerState === "PLAYING" && isActiveFav)) {
        skipFirstTrackUpdate = true;
        nowPlaying.trackStream(currentStation.url);
        nowPlaying.subscribe(handleTrackUpdate);
    } else if (radio.paused) {
        const titleElement = document.getElementById("title_" + currentStation.uuid);
        if (titleElement) {
            titleElement.innerHTML = "Paused";
            setStatusIcon("bi-play-circle");
        }
    }
}

/**
 * Handle track update
 * @param {Object} info - Track information
 */
function handleTrackUpdate(info) {
    if (info.error) {
        console.log(`Error captured with reason: ${info.error}`);
        document.getElementById("title_" + currentStation.uuid).innerHTML = "";
    } else {
        if (!skipFirstTrackUpdate) {
            document.getElementById("title_" + currentStation.uuid).innerHTML = info.title ? 
                `<a class="text-decoration-none text-body-secondary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(info.title)}" target="_blank" title="Search on YouTube" onclick="event.stopPropagation();"><i class="bi bi-youtube text-danger-emphasis"></i> ${info.title}</a>` : "";
            if (info.title) {
                fetchCover(info.title);
                if ('mediaSession' in navigator && !chromeCastIsConnected) {
                    navigator.mediaSession.metadata.artist = info.title;
                }
            }
            document.title = info.title ? `${currentStation.name} - ${info.title}` : currentStation.name;
        } else {
            document.getElementById("title_" + currentStation.uuid).innerHTML = '';
            if ('mediaSession' in navigator && !chromeCastIsConnected) {
                navigator.mediaSession.metadata.artist = "";
            }
            skipFirstTrackUpdate = false;
        }
    }

}



/**
 * Fetch cover
 * @param {string} title - Title
 */
async function fetchCover(title) {
    const escapedTitle = encodeURIComponent(title);
    const url = `/cover?title=${escapedTitle}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        handleCoverResponse(data);
    } catch (error) {
        console.error("Error fetching cover:", error);
    }
}

/**
 * Handle cover response
 * @param {Object} data - Cover data
 */
function handleCoverResponse(data) {
    const coverUrl = data.coverUrl || currentStation.favicon;
    document.getElementById("favicon_" + currentStation.uuid).src = coverUrl;

    if ('mediaSession' in navigator) {
        /*navigator.mediaSession.metadata = new MediaMetadata({
            artwork: [{
                src: coverUrl, type: 'image/png'
            }]
        });*/
        navigator.mediaSession.metadata.artwork = [{
            src: coverUrl, type: 'image/png'
        }]
    }
}