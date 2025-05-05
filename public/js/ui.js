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
 * Show toast message
 * @param {string} message - Message to display
 */
function newToast(message) {
    document.getElementById("toastMessage").innerHTML = message;
    toast.show();
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

function initSortable(){
    return new Sortable(document.getElementById('favourites'), {
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
}

function previewFavicon(url) {
    const preview = document.getElementById('faviconPreview');
    if (url) {
        preview.src = url;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
}