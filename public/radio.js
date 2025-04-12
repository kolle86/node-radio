// Define global constants and variables
const modal = new bootstrap.Modal(document.getElementById('editStationModal'), {});
const liveToast = document.getElementById('liveToast');
const toast = bootstrap.Toast.getOrCreateInstance(liveToast);
const radio = document.getElementById("radio");
const searchButton = document.getElementById("searchButton");

const currentStation = { url: null, name: null, favicon: null, uuid: null };
let favourites;
let playPromise;
let chromeCastPlayerState = null;
let chromeCastIsConnected = false;
let skipFirstTrackUpdate = true;
let selectedSearchBy = 'Name';
let selectedOrderBy = 'Name';

// Initialize audio visualizer
const audioMotion = initAudioMotion();

// Set up Media Session API if available
setupMediaSessionHandlers();

// Initial volume settings
initVolumeSettings();

// Initialize metadata client
const nowPlaying = RadioliseMetadata.createMetadataClient({
    url: 'wss://backend.radiolise.com/api/data-service',
});

const sortable = new Sortable(document.getElementById('favourites'), {
    animation: 150,
    draggable: ".list-group-item",
    delay: 500,
    onEnd: function (/**Event*/evt) {
        fav_temp = favourites.stations[evt.newIndex];
        favourites.stations[evt.newIndex] = favourites.stations[evt.oldIndex];
        favourites.stations[evt.oldIndex] = fav_temp;   
        fetch("/setfavs", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(favourites)
        });
	}    
});

document.getElementById("favourites").addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

// Event listeners for dropdown items
setupDropdownListeners();

// Load favorites
getFavs();

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
 * Sets up the Media Session handlers
 */
function setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
        radio.load();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
        navigateStation(-1);
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        navigateStation(1);
    });
}

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

/**
 * Updates search criteria and UI for station search
 * @param {string} criteria - The search criteria to use
 * @param {HTMLElement} element - The dropdown element that was clicked
 */
function setSearchBy(criteria, element) {
    selectedSearchBy = criteria;
    document.querySelectorAll('#searchBy .dropdown-item i').forEach(icon => icon.classList.remove('bi-check-lg'));
    element.querySelector('i').classList.add('bi-check-lg');
}

/**
 * Updates the order criteria and UI for station sorting
 * @param {string} criteria - The order criteria to use
 * @param {HTMLElement} element - The dropdown element that was clicked
 */
function setOrderBy(criteria, element) {
    selectedOrderBy = criteria;
    document.querySelectorAll('#orderBy .dropdown-item i').forEach(icon => icon.classList.remove('bi-check-lg'));
    element.querySelector('i').classList.add('bi-check-lg');
}

/**
 * Switches to an adjacent station
 * @param {number} direction - Direction (-1 for previous, 1 for next)
 */
function navigateStation(direction) {
    if (!favourites || !favourites.stations || !currentStation.uuid) return;

    for (let i = 0; i < favourites.stations.length; i++) {
        if (favourites.stations[i].uuid === currentStation.uuid) {
            let nextIndex = i + direction;
            if (nextIndex < 0) nextIndex = favourites.stations.length - 1;
            if (nextIndex >= favourites.stations.length) nextIndex = 0;

            const station = favourites.stations[nextIndex];
            clickStation(station.url, station.favicon, station.name, station.uuid);
            break;
        }
    }
}

/**
 * Initializes volume settings from localStorage
 */
function initVolumeSettings() {
    const volumeRange = document.getElementById('volumeRange');

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
 * Sets up event listeners for dropdown items
 */
function setupDropdownListeners() {
    document.querySelectorAll('.dropdown-item.no-close').forEach(item => {
        item.addEventListener('click', event => {
            event.stopPropagation(); // Prevents dropdown from closing
        });
    });
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
 * Click on a station
 * @param {string} url - Stream URL
 * @param {string} artwork - Favicon URL
 * @param {string} station - Station name
 * @param {string} stationuuid - Station UUID
 */
function clickStation(url, artwork, station, stationuuid) {
    if (currentStation.uuid !== stationuuid) {
        // New station was selected
        Object.assign(currentStation, { name: station, url: url, favicon: artwork, uuid: stationuuid });
        document.title = station;
        if (window.cast && window.cast.framework) {
            const castContext = cast.framework.CastContext.getInstance();
            if (castContext.getCurrentSession()) {
                chromeCastPlay();
            } else {
                radio.src = url;
                playPromise = radio.play();
            }
        } else {
            radio.src = url;
            playPromise = radio.play();
        }

    } else {
        // Same station was selected - toggle play/pause
        if (!chromeCastIsConnected) {
            if (radio.paused) {
                radio.load();
            } else {
                // https://developer.chrome.com/blog/play-request-was-interrupted?hl=de
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        radio.pause();
                    }).catch(() => { });
                }
            }
        } else {
            let session = cast.framework.CastContext.getInstance().getCurrentSession();
            if (!session) {
                console.error("Keine aktive Chromecast-Sitzung.");
                return;
            }

            let media = session.getMediaSession();
            if (!media) {
                console.error("Kein aktives Medien-Element auf Chromecast.");
                return;
            }
            let command;
            if (chromeCastPlayerState === "PAUSED") {
                command = new chrome.cast.media.PlayRequest();
                media.play(command,
                    () => console.log("Chromecast play"),
                    (error) => console.error("Error:", error)
                );
            } else if (chromeCastPlayerState === "PLAYING") {
                command = new chrome.cast.media.PauseRequest();
                if (command) {
                    media.pause(command,
                        () => console.log("Chromecast pause"),
                        (error) => console.error("Error:", error)
                    );
                }
            }
        }
    }
}

/**
 * Perform favorites action (add/remove)
 * @param {string} action - "add" or "remove"
 */
function favouritesAction(action) {
    if (!currentStation.url) return;

    if (action === "remove") {
        let stationElement = document.getElementById(currentStation.uuid);
        if (!stationElement?.classList.contains("active")) return;
        if (!stationElement.classList.contains("fav")) return;

        if (confirm(`Remove ${currentStation.name} from favourites?`)) {
            const index = favourites.stations.findIndex(s => s.uuid === currentStation.uuid);
            if (index !== -1) {
                favourites.stations.splice(index, 1);
                saveFavouritesAndUpdate();
                nowPlaying.trackStream(undefined);
            }
        }
    } else if (action === 'add') {
        if (document.getElementById("emptyMessage")) {
            document.getElementById("emptyMessage").remove();
        }
        let stationElement = document.getElementById(currentStation.uuid + "_search");
        if (!stationElement?.classList.contains("active")) return;
        if (stationElement.classList.contains("fav")) return;

        favourites.stations.push({
            url: currentStation.url,
            name: currentStation.name,
            favicon: currentStation.favicon,
            uuid: currentStation.uuid
        });
        saveFavouritesAndUpdate();
    }
    setMenu();
}

/**
 * Saves favorites and updates the display
 */
function saveFavouritesAndUpdate() {
    fetch("/setfavs", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(favourites)
    }).then(() => {
        renderFavourites();
        updateUI();
        setMenu();
    }).catch(error => {
        newToast(`Error saving favourites: ${error.message}`);
    });
}

/**
 * Renders favorites
 */
function renderFavourites() {
    // Remove existing favorites
    document.querySelectorAll(".fav").forEach(element => element.remove());

    const favouritesContainer = document.getElementById("favourites");

    if (!favourites.stations || favourites.stations.length === 0) {
        const emptyMessage = document.createElement("li");
        emptyMessage.innerHTML = 'Favourites are empty. <br>Select the upper right dropdown and search for stations. <br>Select a station from the results and add it to the favourites via the dropdown.';
        emptyMessage.setAttribute("class", "list-group-item");
        emptyMessage.id = "emptyMessage"
        favouritesContainer.appendChild(emptyMessage);
        return;
    }

    // Add favorites
    favourites.stations.forEach(station => {
        const newFav = document.createElement("a");
        newFav.innerHTML = `
            <div class="ms-2 me-auto">
                <div class="fw-bold">
                    <span class="me-1 bi" id="status_${station.uuid}"></span>
                    ${station.name}
                </div>
                <div class="title text-break">
                    <span id="title_${station.uuid}"></span>
                </div>
            </div>
            <img id="favicon_${station.uuid}" class="rounded shadow-lg station-icon" src="${station.favicon}" onerror="this.src='radio.svg'">
        `;
        newFav.href = "javascript:void(0);";
        newFav.id = station.uuid;
        newFav.setAttribute("class", "list-group-item list-group-item-action d-flex justify-content-between align-items-start fav");
        newFav.setAttribute("onclick", `clickStation('${station.url}','${station.favicon}','${station.name}','${station.uuid}')`);
        favouritesContainer.appendChild(newFav);
    });

}

/**
 * Load favorites
 */
async function getFavs() {
    try {
        const response = await fetch("/getfavs");
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        favourites = await response.json();
        renderFavourites();
    } catch (error) {
        newToast(error.message);
    }
}

/**
 * Move favorite
 * @param {string} direction - "up" or "down"
 */
function moveFav(direction) {
    const stationElement = document.getElementById(currentStation.uuid);
    if (!stationElement?.classList.contains("active") || !stationElement?.classList.contains("fav")) return;

    const index = favourites.stations.findIndex(s => s.uuid === currentStation.uuid);
    if (index === -1) return;

    const item = favourites.stations.splice(index, 1)[0];

    if (direction === "up") {
        const newIndex = index === 0 ? favourites.stations.length : index - 1;
        favourites.stations.splice(newIndex, 0, item);
    } else {
        const newIndex = index >= favourites.stations.length ? 0 : index + 1;
        favourites.stations.splice(newIndex, 0, item);
    }

    saveFavouritesAndUpdate();
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
    ["bi-volume-up", "bi-volume-down", "bi-volume-mute"].forEach(cls => {
        if (volumeIcon.classList.contains(cls)) {
            volumeIcon.classList.replace(cls, newIcon);
        }
    });
}

/**
 * Toggle mute
 */
function mute() {
    const volumeRange = document.getElementById('volumeRange');
    radio.muted = !radio.muted;
    volumeRange.disabled = radio.muted;

    if (radio.muted) {
        replaceVolumeIcon('bi-volume-mute');
        document.getElementById("volumeProgress").classList.add("volume-disabled");
    } else {
        changeVolume(parseInt(radio.volume * 100));
        document.getElementById("volumeProgress").classList.remove("volume-disabled");
    }
}

/**
 * Show edit dialog
 */
function toggleEditModal() {
    const stationElement = document.getElementById(currentStation.uuid);
    if (!stationElement?.classList.contains("active") || !stationElement?.classList.contains("fav")) return;

    document.getElementById("editStationNameInput").value = currentStation.name;
    document.getElementById("editStationFaviconInput").value = currentStation.favicon;
    document.getElementById("editStationURLInput").value = currentStation.url;
    document.getElementById("editStationUidInput").value = currentStation.uuid;
    modal.show();
}

/**
 * Save edited favorite
 */
function saveEditedFavourite() {
    const stationUuid = document.getElementById("editStationUidInput").value;
    const index = favourites.stations.findIndex(s => s.uuid === stationUuid);

    if (index !== -1) {
        // Update station
        const updatedValues = {
            name: document.getElementById("editStationNameInput").value,
            favicon: document.getElementById("editStationFaviconInput").value,
            url: document.getElementById("editStationURLInput").value
        };

        Object.assign(favourites.stations[index], updatedValues);
        Object.assign(currentStation, updatedValues);

        fetch("/setfavs", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(favourites)
        }).then(() => {
            renderFavourites();
            if (radio.src != updatedValues.url) {
                if (cast.framework.CastContext.getInstance().getCurrentSession()) {
                    chromeCastPlay();
                } else {
                    radio.src = currentStation.url;
                }
            }
            updateUI();
            modal.hide();
        }).catch(error => {
            newToast(`Error saving edited station: ${error.message}`);
        });
    }
}

/**
 * Show toast message
 * @param {string} message - Message to display
 */
function newToast(message) {
    document.getElementById("toastMessage").innerHTML = message;
    toast.show();
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

/**
 * Set status icon
 * @param {string} icon - CSS class of the icon
 */
function setStatusIcon(icon) {
    if (!currentStation.uuid) return;

    const statusElement = document.getElementById("status_" + currentStation.uuid);
    if (!statusElement) return;

    statusElement.classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
    statusElement.classList.add(icon);
}

/**
 * Update UI
 */
function updateUI() {
    // Reset all list items and mark the active one
    const items = document.getElementsByClassName('list-group-item');

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.classList.remove('active');

        if (item.classList.contains("fav")) {
            const faviconElement = document.getElementById("favicon_" + item.id);

            if (faviconElement?.classList.contains("cover")) {
                faviconElement.classList.remove('cover');
                faviconElement.classList.add('station-icon');

                const station = favourites.stations.find(s => s.uuid === item.id);
                if (station) faviconElement.src = station.favicon;
            }
        }

        // Reset title and status if not active
        const titleElement = document.getElementById("title_" + item.id);
        const statusElement = document.getElementById("status_" + item.id);

        if (titleElement && item.id !== currentStation.uuid) {
            titleElement.innerHTML = "";
        }

        if (statusElement && item.id !== currentStation.uuid) {
            statusElement.classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
        }

        // Mark active station
        if (item.id === currentStation.uuid || item.id === currentStation.uuid + "_search") {
            item.classList.add('active');

            if (item.classList.contains("fav")) {
                const faviconElement = document.getElementById("favicon_" + item.id);
                if (faviconElement) {
                    faviconElement.classList.remove('station-icon');
                    faviconElement.classList.add('cover');
                }
            }

            if (statusElement && !radio.paused) {
                setStatusIcon("bi-pause-circle");
            }
        }
    }

    // Update dropdown status
    updateDropdownStatus();

    // Update Media Session Metadata
    updateMediaSessionMetadata();

    // Subscribe to track information if a station is playing
    handleTrackInfo();

    // Update menu status
    setMenu();
}

/**
 * Update dropdown status
 */
function updateDropdownStatus() {
    const dropdownStation = document.getElementById("dropdown_station");
    dropdownStation.classList.remove("bi-bookmark-check", "bi-bookmark-x");

    const isBookmarked = document.getElementById(currentStation.uuid)?.classList.contains("fav");
    dropdownStation.classList.add(isBookmarked ? "bi-bookmark-check" : "bi-bookmark-x");
    dropdownStation.innerHTML = " " + currentStation.name;
}

/**
 * Update Media Session Metadata
 */
function updateMediaSessionMetadata() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentStation.name,
            artwork: [{
                src: currentStation.favicon, type: 'image/png'
            }]
        });
    }
}

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
            document.getElementById("title_" + currentStation.uuid).innerHTML = info.title;
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
 * Set menu status
 */
function setMenu() {
    const menuItems = [
        "menuEdit", "menuAdd", "menuRemove", "moveFavUp", "moveFavDown"
    ];

    // Disable all menu items
    menuItems.forEach(id => {
        document.getElementById(id).classList.add("disabled");
    });

    const activeElements = document.querySelectorAll(".list-group-item.active");
    if (!activeElements) return;
    activeElements.forEach(activeElement => {
        const isActiveFav = activeElement.classList.contains("fav");

        if (isActiveFav) {
            // Favorite is active
            document.getElementById("menuEdit").classList.remove("disabled");
            document.getElementById("menuRemove").classList.remove("disabled");
            document.getElementById("moveFavUp").classList.remove("disabled");
            document.getElementById("moveFavDown").classList.remove("disabled");
            document.getElementById("menuAdd").classList.add("disabled");
        } else {
            // Non-favorite is active
            document.getElementById("menuAdd").classList.remove("disabled");
        }
    });

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

/**
 * Searches for radio stations using the /search route
 * @param {string} searchTerm - The search term
 */
async function searchStations(searchTerm, searchBy, orderBy) {
    const url = `/search?searchterm=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchBy)}&orderBy=${encodeURIComponent(orderBy)}`;
    if (searchTerm.length >= 1) {
        searchButton.innerHTML = "<span class='spinner-border'></span>";
        searchButton.classList.remove("bi-search");
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) {
                //newToast(data.error);
                throw new Error(`Response status: ${data.error}`);
            }
            appendSearchResults(data);
        } catch (error) {
            searchButton.innerHTML = "";
            searchButton.classList.add("bi-search");
            console.error("Error searching stations:", error);
            newToast(error.message);
        }
    } else {
        newToast("Please enter at least 1 character.");
    }
}

/**
 * Appends search results to the page
 * @param {Array<Object>} stations - Array of station objects to display
 */
function appendSearchResults(stations) {
    searchButton.innerHTML = "";
    searchButton.classList.add("bi-search");
    const container = document.getElementById("searchResults");
    container.classList.add("mt-2");
    container.innerHTML = "";

    const listGroup = document.createElement("ol");
    listGroup.id = "stations";
    listGroup.className = "list-group";
    container.appendChild(listGroup);

    if (stations.length > 0) {
        const headerItem = document.createElement("li");
        headerItem.className = "list-group-item d-flex justify-content-between align-items-center bg-dark-subtle";
        headerItem.textContent = "Search results";

        const closeButton = document.createElement("button");
        closeButton.className = "btn btn-sm btn-secondary bi bi-x-lg";
        closeButton.onclick = function () {
            resetSearch();
        };
        headerItem.appendChild(closeButton);
        listGroup.appendChild(headerItem);

        let index = 0;
        const batchSize = 100;

        function loadMore() {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < batchSize && index < stations.length; i++, index++) {
                const station = stations[index];
                const listItem = document.createElement("a");
                listItem.id = station.stationuuid + "_search";
                listItem.href = "javascript:void(0);";
                listItem.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-start px-1";
                listItem.onclick = function () {
                    clickStation(station.url_resolved, station.favicon, station.name, station.stationuuid);
                };
                const img = document.createElement("img");
                img.className = "rounded shadow-lg station-icon-search";
                if (station.favicon) {
                    img.src = station.favicon;
                } else {
                    img.src = "radio.svg"
                }
                img.loading = "lazy";
                listItem.appendChild(img);

                const textContainer = document.createElement("div");
                textContainer.className = "ms-2 me-auto text-break";
                const stationName = document.createElement("div");
                stationName.className = "fw-bold small";
                stationName.textContent = station.name;
                textContainer.appendChild(stationName);

                if (station.country) {
                    textContainer.appendChild(document.createTextNode(station.country + " "));
                }

                const details = [];
                if (station.bitrate) details.push(`${station.bitrate} kbps`);
                if (station.codec) details.push(station.codec);
                if (details.length > 0) {
                    const span = document.createElement("span");
                    span.className = "text-muted";
                    span.textContent = `[${details.join(" ")}]`;
                    textContainer.appendChild(span);
                }

                listItem.appendChild(textContainer);

                const badgeDiv = document.createElement("div");
                badgeDiv.className = "d-flex flex-column gap-1 align-items-end";
                if (station.votes) {
                    const spanVotes = document.createElement("span");
                    spanVotes.className = "badge text-bg-dark border rounded-pill bi bi-hand-thumbs-up";
                    spanVotes.textContent = station.votes;
                    badgeDiv.appendChild(spanVotes);
                }
                if (station.clickcount) {
                    const spanClicks = document.createElement("span");
                    spanClicks.className = "badge text-bg-dark border rounded-pill bi bi-mouse";
                    spanClicks.textContent = station.clickcount;
                    badgeDiv.appendChild(spanClicks);
                }
                listItem.appendChild(badgeDiv);
                fragment.appendChild(listItem);
            }
            listGroup.appendChild(fragment);

            if (index < stations.length) {
                const loadMoreButton = document.createElement("button");
                loadMoreButton.className = "btn btn-primary mt-2 bi bi-chevron-double-down";
                loadMoreButton.textContent = " Show more";
                loadMoreButton.onclick = function () {
                    loadMoreButton.remove();
                    loadMore();
                };
                container.appendChild(loadMoreButton);
            }
        }

        loadMore();
    } else {
        const listItem = document.createElement("li");
        listItem.className = "list-group-item";
        listItem.textContent = "No results";
        listGroup.appendChild(listItem);
    }
}

/**
 * Clears the search results and resets the search field
 */
function resetSearch() {
    document.getElementById("searchResults").innerHTML = "";
    document.getElementById("searchResults").classList.remove("mt-2");
    document.getElementById("searchField").value = "";
    setMenu();
}

/**
 * Handles search form submission when Enter key is pressed
 * @param {KeyboardEvent} event - The keyboard event object
 */
function submitSearch(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        searchButton.onclick();
    }
}

// Event listeners
radio.onvolumechange = () => {
    localStorage.setItem("volume", radio.volume);
};

radio.onpause = () => {
    if (!radio.error) {
        nowPlaying.trackStream(undefined);

        const titleElement = document.getElementById("title_" + currentStation.uuid);
        const faviconElement = document.getElementById("favicon_" + currentStation.uuid);

        if (titleElement) {
            titleElement.innerHTML = "Paused";
            if (faviconElement) faviconElement.src = currentStation.favicon;

            updateMediaSessionMetadata();
            setStatusIcon("bi-play-circle");
        }

        document.title = currentStation.name;
    }
};

radio.onerror = () => {
    if (currentStation.uuid) {
        const titleElement = document.getElementById("title_" + currentStation.uuid);
        if (titleElement) titleElement.innerHTML = radio.error.message;
        setStatusIcon("bi-x-circle");
    }

    newToast(radio.error.message);
    setMenu();
};

radio.onplay = () => {
    updateUI();
};

radio.onplaying = () => {
    setStatusIcon("bi-pause-circle");
};

radio.onloadstart = () => {
    setStatusIcon("spinner-border");
};

radio.onloadeddata = () => {
    setStatusIcon("bi-pause-circle");
    playPromise = radio.play();
};

radio.onwaiting = () => {
    setStatusIcon("spinner-border");
};

// Monitor window resize
window.addEventListener('resize', resizedWindowEvent);
