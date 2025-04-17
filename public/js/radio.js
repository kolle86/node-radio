// Define global constants and variables
const modal = new bootstrap.Modal(document.getElementById('editStationModal'), {});
const liveToast = document.getElementById('liveToast');
const toast = bootstrap.Toast.getOrCreateInstance(liveToast);
const radio = document.getElementById("radio");
const searchButton = document.getElementById("searchButton");
let chromeCastPlayerState = null;
let chromeCastIsConnected = false;

const currentStation = { url: null, name: null, favicon: null, uuid: null };
let favourites;
let playPromise;

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

//Initialize Sortable Favs List
const sortable = initSortable();

document.getElementById("favourites").addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

// Event listeners for dropdown items
setupDropdownListeners();

// Load favorites
getFavs();

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
