// Konstanten und Variablen global definieren
const modal = new bootstrap.Modal(document.getElementById('editStationModal'), {});
const liveToast = document.getElementById('liveToast');
const toast = bootstrap.Toast.getOrCreateInstance(liveToast);
const radio = document.getElementById("radio");
const currentStation = { url: null, name: null, favicon: null, uuid: null };
let favourites;
let playPromise;

// Audio-Visualizer initialisieren
const audioMotion = initAudioMotion();

// Media Session API einrichten, wenn verfügbar
setupMediaSessionHandlers();

// Initiale Lautstärkeeinstellungen
initVolumeSettings();

// Metadaten-Client initialisieren
const nowPlaying = RadioliseMetadata.createMetadataClient({
    url: 'wss://backend.radiolise.com/api/data-service',
});

// Event-Listener für Dropdown-Items
setupDropdownListeners();

// Favoriten laden
getFavs();

/**
 * Initialisiert den AudioMotion-Analyzer
 * @returns {Object} AudioMotion-Instanz
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
    analyzer.setOptions({ gradient: 'myGradient' });

    // Visualizer-Einstellungen aus dem localStorage laden
    if (localStorage.getItem("visualizer") === "0") {
        analyzer.toggleAnalyzer();
        document.getElementById("visualizer").style.visibility = "hidden";
        document.getElementById("visualizerCheck").checked = false;
    }

    return analyzer;
}

/**
 * Richtet die Media Session Handler ein
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
 * Wechselt zu einem benachbarten Sender
 * @param {number} direction - Richtung (-1 für vorherigen, 1 für nächsten)
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
 * Initialisiert die Lautstärkeeinstellungen aus dem localStorage
 */
function initVolumeSettings() {
    const volumeRange = document.getElementById('volumeRange');
    
    if (localStorage.getItem("volume") !== null) {
        const savedVolume = localStorage.getItem("volume");
        radio.volume = parseFloat(savedVolume);
        volumeRange.value = savedVolume * 100;
        changeVolume(savedVolume * 100);
    } else {
        volumeRange.value = radio.volume * 100;
    }
}

/**
 * Event-Listener für Dropdown-Items einrichten
 */
function setupDropdownListeners() {
    document.querySelectorAll('.dropdown-item.no-close').forEach(item => {
        item.addEventListener('click', event => {
            event.stopPropagation(); // Verhindert das Schließen des Dropdowns
        });
    });
}

/**
 * Visualizer ein-/ausschalten
 */
function toggleVisualizer() {
    audioMotion.toggleAnalyzer();
    const visualizer = document.getElementById("visualizer");
    const isVisible = getComputedStyle(visualizer).visibility === 'visible';
    
    visualizer.style.visibility = isVisible ? "hidden" : "visible";
    localStorage.setItem("visualizer", isVisible ? 0 : 1);
}

/**
 * Klicken auf einen Sender
 * @param {string} url - Stream-URL
 * @param {string} artwork - Favicon-URL
 * @param {string} station - Stationsname
 * @param {string} stationuuid - Stations-UUID
 */
function clickStation(url, artwork, station, stationuuid) {
    if (currentStation.uuid !== stationuuid) {
        // Neuer Sender wurde ausgewählt
        Object.assign(currentStation, { name: station, url: url, favicon: artwork, uuid: stationuuid });
        document.title = station;
        radio.src = url;
        playPromise = radio.play();
    } else {
        // Derselbe Sender wurde ausgewählt - Play/Pause umschalten
        if (radio.paused) {
            radio.load();
        } else {
            // https://developer.chrome.com/blog/play-request-was-interrupted?hl=de
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    radio.pause();
                }).catch(() => {});
            }
        }
    }
}

/**
 * Favoriten-Aktion durchführen (hinzufügen/entfernen)
 * @param {string} action - "add" oder "remove"
 */
function favouritesAction(action) {
    if (!currentStation.url) return;
    
    const stationElement = document.getElementById(currentStation.uuid);
    if (!stationElement?.classList.contains("active")) return;
    
    if (action === "remove") {
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
        if (stationElement.classList.contains("fav")) return;
        
        favourites.stations.push({
            url: currentStation.url,
            name: currentStation.name,
            favicon: currentStation.favicon,
            uuid: currentStation.uuid
        });
        saveFavouritesAndUpdate();
    }
}

/**
 * Speichert Favoriten und aktualisiert die Anzeige
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
 * Favoriten rendern
 */
function renderFavourites() {
    // Bestehende Favoriten entfernen
    document.querySelectorAll(".fav").forEach(element => element.remove());
    
    const favouritesContainer = document.getElementById("favourites");
    
    if (!favourites.stations || favourites.stations.length === 0) {
        const emptyMessage = document.createElement("li");
        emptyMessage.innerHTML = 'Favourites are empty. <br>Select the upper right dropdown and search for stations. <br>Select a station from the results and add it to the favourites via the dropdown.';
        emptyMessage.setAttribute("class", "list-group-item");
        favouritesContainer.appendChild(emptyMessage);
        return;
    }

    // Favoriten hinzufügen
    favourites.stations.forEach(station => {
        const newFav = document.createElement("a");
        newFav.innerHTML = `
            <div class="ms-2 me-auto">
                <div class="fw-bold">${station.name}</div>
                <div class="title">
                    <span class="me-1 bi" id="status_${station.uuid}"></span>
                    <span id="title_${station.uuid}"></span>
                </div>
            </div>
            <img id="favicon_${station.uuid}" class="rounded border station-icon" src="${station.favicon}">
        `;
        newFav.href = "javascript:void(0);";
        newFav.id = station.uuid;
        newFav.setAttribute("class", "list-group-item list-group-item-action d-flex justify-content-between align-items-start fav");
        newFav.setAttribute("onclick", `clickStation('${station.url}','${station.favicon}','${station.name}','${station.uuid}')`);
        favouritesContainer.appendChild(newFav);
    });
}

/**
 * Favoriten laden
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
 * Favoriten verschieben
 * @param {string} direction - "up" oder "down"
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
 * Lautstärke ändern
 * @param {number} value - Lautstärkewert (0-100)
 */
function changeVolume(value) {
    radio.volume = value / 100;
    localStorage.setItem("volume", radio.volume);
    
    // Icon entsprechend anpassen
    let iconClass = "bi-volume-up";
    if (value === 0) {
        iconClass = "bi-volume-mute";
    } else if (value < 50) {
        iconClass = "bi-volume-down";
    }
    
    replaceVolumeIcon(iconClass);
}

/**
 * Lautstärke-Icon ersetzen
 * @param {string} newIcon - CSS-Klasse des neuen Icons
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
 * Stummschalten umschalten
 */
function mute() {
    const volumeRange = document.getElementById('volumeRange');
    radio.muted = !radio.muted;
    volumeRange.disabled = radio.muted;
    
    if (radio.muted) {
        replaceVolumeIcon('bi-volume-mute');
    } else {
        changeVolume(parseInt(radio.volume * 100));
    }
}

/**
 * Bearbeitungsdialog anzeigen
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
 * Bearbeiteten Favoriten speichern
 */
function saveEditedFavourite() {
    const stationUuid = document.getElementById("editStationUidInput").value;
    const index = favourites.stations.findIndex(s => s.uuid === stationUuid);
    
    if (index !== -1) {
        // Station aktualisieren
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
            radio.src = currentStation.url;
            updateUI();
            modal.hide();
        }).catch(error => {
            newToast(`Error saving edited station: ${error.message}`);
        });
    }
}

/**
 * Toast-Nachricht anzeigen
 * @param {string} message - Anzuzeigende Nachricht
 */
function newToast(message) {
    document.getElementById("toastMessage").innerHTML = message;
    toast.show();
}

/**
 * AudioMotion-Modus ermitteln
 * @returns {number} AudioMotion-Modus
 */
function getAudioMotionMode() {
    let mode = 12 - parseInt(window.innerWidth / 100);
    return Math.max(2, Math.min(6, mode));
}

/**
 * Fenstergrößenänderung behandeln
 */
function resizedWindowEvent() {
    const newMode = getAudioMotionMode();
    if (newMode !== audioMotion.getOptions().mode) {
        audioMotion.setOptions({ mode: newMode });
    }
}

/**
 * Status-Icon setzen
 * @param {string} icon - CSS-Klasse des Icons
 */
function setStatusIcon(icon) {
    if (!currentStation.uuid) return;
    
    const statusElement = document.getElementById("status_" + currentStation.uuid);
    if (!statusElement) return;
    
    statusElement.classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
    statusElement.classList.add(icon);
}

/**
 * UI aktualisieren
 */
function updateUI() {
    // Alle Listeneinträge zurücksetzen und den aktiven markieren
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
        
        // Titel und Status zurücksetzen, wenn nicht aktiv
        const titleElement = document.getElementById("title_" + item.id);
        const statusElement = document.getElementById("status_" + item.id);
        
        if (titleElement && item.id !== currentStation.uuid) {
            titleElement.innerHTML = "";
        }
        
        if (statusElement && item.id !== currentStation.uuid) {
            statusElement.classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
        }
        
        // Aktiven Sender markieren
        if (item.id === currentStation.uuid) {
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
    
    // Dropdown-Status aktualisieren
    updateDropdownStatus();
    
    // Media Session Metadata aktualisieren
    updateMediaSessionMetadata();
    
    // Track-Informationen abonnieren, wenn ein Sender läuft
    handleTrackInfo();
    
    // Menüstatus aktualisieren
    setMenu();
}

/**
 * Dropdown-Status aktualisieren
 */
function updateDropdownStatus() {
    const dropdownStation = document.getElementById("dropdown_station");
    dropdownStation.classList.remove("bi-bookmark-check", "bi-bookmark-x");
    
    const isBookmarked = document.getElementById(currentStation.uuid)?.classList.contains("fav");
    dropdownStation.classList.add(isBookmarked ? "bi-bookmark-check" : "bi-bookmark-x");
    dropdownStation.innerHTML = " " + currentStation.name;
}

/**
 * Media Session Metadata aktualisieren
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
 * Track-Informationen behandeln
 */
function handleTrackInfo() {
    const isActiveFav = document.getElementById(currentStation.uuid)?.classList.contains("fav");
    
    if (!radio.paused && isActiveFav) {
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
 * Track-Update behandeln
 * @param {Object} info - Track-Informationen
 */
function handleTrackUpdate(info) {
    if (info.error) {
        console.log(`Error captured with reason: ${info.error}`);
        document.getElementById("title_" + currentStation.uuid).innerHTML = "";
    } else {
        document.getElementById("title_" + currentStation.uuid).innerHTML = info.title;
        if (info.title) {
            fetchCover(info.title);
        }
    }
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata.artist = info.title;
    }
    
    document.title = info.title ? `${currentStation.name} - ${info.title}` : currentStation.name;
}

/**
 * Menüstatus setzen
 */
function setMenu() {
    const menuItems = [
        "menuEdit", "menuAdd", "menuRemove", "moveFavUp", "moveFavDown"
    ];
    
    // Alle Menüpunkte deaktivieren
    menuItems.forEach(id => {
        document.getElementById(id).classList.add("disabled");
    });
    
    const activeElement = document.querySelector(".list-group-item.active");
    if (!activeElement) return;
    
    const isActiveFav = activeElement.classList.contains("fav");
    
    if (isActiveFav) {
        // Favorit ist aktiv
        document.getElementById("menuEdit").classList.remove("disabled");
        document.getElementById("menuRemove").classList.remove("disabled");
        document.getElementById("moveFavUp").classList.remove("disabled");
        document.getElementById("moveFavDown").classList.remove("disabled");
    } else {
        // Nicht-Favorit ist aktiv
        document.getElementById("menuAdd").classList.remove("disabled");
    }
}

/**
 * Suchergebnisse schließen
 */
function closeSearchResults() {
    document.getElementById('searchResults').remove();
    setMenu();
}

/**
 * Cover abrufen
 * @param {string} title - Titel
 */
async function fetchCover(title) {
    const escapedTitle = encodeURIComponent(title);
    const url = `/cover?title=${escapedTitle}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        handleCoverResponse(data);
    } catch (error) {
        console.error("Fehler beim Abrufen des Covers:", error);
    }
}

/**
 * Cover-Antwort behandeln
 * @param {Object} data - Cover-Daten
 */
function handleCoverResponse(data) {
    const coverUrl = data.coverUrl || currentStation.favicon;
    document.getElementById("favicon_" + currentStation.uuid).src = coverUrl;
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            artwork: [{
                src: coverUrl, type: 'image/png'
            }]
        });
    }
}

// Event-Listener
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

// Fenstergrößenänderung überwachen
window.addEventListener('resize', resizedWindowEvent);