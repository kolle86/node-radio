const modal = new bootstrap.Modal(document.getElementById('editStationModal'), {})
const liveToast = document.getElementById('liveToast')
const toast = bootstrap.Toast.getOrCreateInstance(liveToast)
const currentStation = { url: null, name: null, favicon: null, uuid: null };
var favourites;
var playPromise;

const audioMotion = new AudioMotionAnalyzer(
    document.getElementById('visualizer'),
    {
        source: document.getElementById('radio'),
        height: 48,
        showScaleX: false,
        overlay: true,
        showBgColor: true,
        bgAlpha: 0,
        mode: getAudioMotionMode(),
        //gradient: 'steelblue'
    }
);

audioMotion.registerGradient('myGradient', {
    colorStops: [       // list your gradient colors in this array (at least one color is required)  
        //{ color: '#2b3035'}, // use `level` to set the max bar amplitude (0 to 1) to use this color
        { color: '#6c757d' }
    ]
});
audioMotion.setOptions({ gradient: 'myGradient' });

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', function () {
        radio.load();
    });

    navigator.mediaSession.setActionHandler('previoustrack', function () {
        var nextStation;
        for (let i = 0; i < favourites.stations.length; i++) {
            if (favourites.stations[i].uuid == currentStation.uuid) {
                nextStation = i - 1;
                if (nextStation < 0) {
                    nextStation = favourites.stations.length - 1;
                }
                clickStation(favourites.stations[nextStation].url, favourites.stations[nextStation].favicon, favourites.stations[nextStation].name, favourites.stations[nextStation].uuid)
                break;
            }
        }
    });

    navigator.mediaSession.setActionHandler('nexttrack', function () {
        var nextStation;
        for (let i = 0; i < favourites.stations.length; i++) {
            if (favourites.stations[i].uuid == currentStation.uuid) {
                nextStation = i + 1;
                if (nextStation > favourites.stations.length - 1) {
                    nextStation = 0;
                }
                clickStation(favourites.stations[nextStation].url, favourites.stations[nextStation].favicon, favourites.stations[nextStation].name, favourites.stations[nextStation].uuid)
                break;
            }
        }
    });
}

const radio = document.getElementById("radio");

if (localStorage.getItem("volume") != null) {
    document.getElementById('radio').volume = (localStorage.getItem("volume"));
    document.getElementById('volumeRange').value = localStorage.getItem("volume") * 100;
    changeVolume(localStorage.getItem("volume") * 100);
} else {
    document.getElementById('volumeRange').value = radio.volume * 100;
}
if (localStorage.getItem("visualizer") != null) {
    if (localStorage.getItem("visualizer") == 0) {
        audioMotion.toggleAnalyzer();
        document.getElementById("visualizer").style.visibility = "hidden";
        document.getElementById("visualizerCheck").checked = false;
    }
}

const nowPlaying = RadioliseMetadata.createMetadataClient({
    url: 'wss://backend.radiolise.com/api/data-service',
})

document.querySelectorAll('.dropdown-item.no-close').forEach(item => {
    item.addEventListener('click', function (event) {
        event.stopPropagation(); // Verhindert das Schließen des Dropdowns
    });
});

getFavs();

function toggleVisualizer() {
    audioMotion.toggleAnalyzer();
    visualizer = document.getElementById("visualizer");
    if (getComputedStyle(visualizer).visibility === 'visible') {
        visualizer.style.visibility = "hidden";
        localStorage.setItem("visualizer", 0);
    } else {
        visualizer.style.visibility = "visible";
        localStorage.setItem("visualizer", 1);
    }

}

function clickStation(url, artwork, station, stationuuid) {
    if (currentStation.uuid != stationuuid) {
        currentStation.name = station;
        currentStation.url = url;
        currentStation.favicon = artwork;
        currentStation.uuid = stationuuid;
        document.title = station;
        radio.src = url;
        playPromise = radio.play();
    } else {
        if (radio.paused) {
            radio.load();
        }
        else if (!radio.paused) {
            // https://developer.chrome.com/blog/play-request-was-interrupted?hl=de
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    radio.pause();
                })
                    .catch(error => {
                    });
            }
        }
    }
}

function favouritesAction(action) {
    if (currentStation.url != null) {
        var data = JSON.stringify({ url: currentStation.url, name: currentStation.name, favicon: currentStation.favicon, uuid: currentStation.uuid });
        if (action == "remove") {
            if (confirm("Remove " + currentStation.name + " from favourites?")) {
                if (document.getElementById(currentStation.uuid) != null) {
                    if (document.getElementById(currentStation.uuid).classList.contains("active") && document.getElementById(currentStation.uuid).classList.contains("fav")) {

                        for (let i = 0; i < favourites.stations.length; i++) {
                            if (favourites.stations[i].uuid == currentStation.uuid) {
                                favourites.stations.splice(i, 1);
                            }
                        }

                        fetch("/setfavs", {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(favourites)
                        }).then(response => {
                            renderFavourites();
                            nowPlaying.trackStream(undefined);
                            updateUI();
                            setMenu();
                        });

                    }
                }
            }
        } else if (action == 'add') {
            if (document.getElementById(currentStation.uuid) != null) {
                if (document.getElementById(currentStation.uuid).classList.contains("active")) {
                    if (!document.getElementById(currentStation.uuid).classList.contains("fav")) {
                        favourites.stations.push(JSON.parse(data));
                        fetch("/setfavs", {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(favourites)
                        }).then(response => {
                            renderFavourites();
                            updateUI();
                            setMenu();
                        });
                    }
                }
            }
        }
    }
}

function renderFavourites() {
    Array.from(document.getElementsByClassName("fav")).forEach(element => {
        element.remove();
    });
    if (favourites.stations.length > 0) {
        for (let index = 0; index < favourites.stations.length; index++) {
            var newFav = document.createElement("a");
            newFav.innerHTML = '<div class="ms-2 me-auto"><div class="fw-bold">' + favourites.stations[index].name + '</div>\
                <div class="title"><span class="me-1 bi" id="status_' + favourites.stations[index].uuid + '"></span>\
                <span id="title_' + favourites.stations[index].uuid + '"></span></div></div>\
                <img id="favicon_' + favourites.stations[index].uuid + '" class="rounded border" src="' + favourites.stations[index].favicon + '">';
            newFav.href = "javascript:void(0);"
            newFav.id = favourites.stations[index].uuid;
            newFav.setAttribute("class", "list-group-item list-group-item-action d-flex justify-content-between align-items-start fav");
            newFav.setAttribute("onclick", "clickStation('" + favourites.stations[index].url + "','" + favourites.stations[index].favicon + "','" + favourites.stations[index].name + "','" + favourites.stations[index].uuid + "')");
            document.getElementById("favourites").appendChild(newFav);
        }
    } else {
        var newFav = document.createElement("li");
        newFav.innerHTML = 'Favourites are empty. <br>Select the upper right dropdown and search for stations. <br>Select a station from the results and add it to the favourites via the dropdown.';
        newFav.setAttribute("class", "list-group-item fav");
        document.getElementById("favourites").appendChild(newFav);

    }
}

async function getFavs() {
    try {
        const response = await fetch("/getfavs");
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const json = await response.json();
        favourites = json;
        renderFavourites();
    } catch (error) {
        newToast(error.message);
    }
}

function moveFav(direction) {
    if (document.getElementById(currentStation.uuid) != null) {
        if (document.getElementById(currentStation.uuid).classList.contains("active") && document.getElementById(currentStation.uuid).classList.contains("fav")) {
            for (let i = 0; i < favourites.stations.length; i++) {
                if (favourites.stations[i].uuid == currentStation.uuid) {
                    var item = favourites.stations.splice(i, 1)[0];
                    if (direction == "up") {
                        if (i - 1 < 0) {
                            favourites.stations.push(item);
                        } else {
                            favourites.stations.splice(i - 1, 0, item);
                        }
                    } else {
                        if (i + 1 > favourites.stations.length) {
                            favourites.stations.unshift(item);
                        } else {
                            favourites.stations.splice(i + 1, 0, item);
                        }
                    }
                    break;
                }
            }
            fetch("/setfavs", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(favourites)
            }).then(response => {
                renderFavourites();
                updateUI();
                setMenu();
            });
        }
    }
}


function changeVolume(value) {
    document.getElementById('radio').volume = (value / 100);
}

function changeVolume(value) {
    document.getElementById('radio').volume = (value / 100);
    if (value >= 50) {
        replaceVolumeIcon("bi-volume-up");
    } else if (value > 0 && value <= 49) {
        replaceVolumeIcon("bi-volume-down");
    } else if (value == 0) {
        replaceVolumeIcon("bi-volume-mute");
    }
}

function replaceVolumeIcon(newIcon) {
    document.getElementById("volume_icon").classList.replace("bi-volume-up", newIcon);
    document.getElementById("volume_icon").classList.replace("bi-volume-down", newIcon);
    document.getElementById("volume_icon").classList.replace("bi-volume-mute", newIcon);
}

function mute() {
    if (document.getElementById('radio').muted) {
        document.getElementById('radio').muted = false;
        document.getElementById('volumeRange').disabled = false;
        changeVolume(parseInt(document.getElementById('radio').volume * 100));
    } else {
        document.getElementById('radio').muted = true;
        document.getElementById('volumeRange').disabled = true;
        replaceVolumeIcon('bi-volume-mute')
    }
}

function toggleEditModal() {
    if (document.getElementById(currentStation.uuid) != null) {
        if (document.getElementById(currentStation.uuid).classList.contains("active")) {
            if (document.getElementById(currentStation.uuid).classList.contains("fav")) {
                document.getElementById("editStationNameInput").value = currentStation.name;
                document.getElementById("editStationFaviconInput").value = currentStation.favicon;
                document.getElementById("editStationURLInput").value = currentStation.url;
                document.getElementById("editStationUidInput").value = currentStation.uuid;
                modal.show();
            }
        }
    }
}

function saveEditedFavourite() {
    for (let i = 0; i < favourites.stations.length; i++) {
        if (favourites.stations[i].uuid == document.getElementById("editStationUidInput").value) {
            favourites.stations[i].name = document.getElementById("editStationNameInput").value;
            favourites.stations[i].favicon = document.getElementById("editStationFaviconInput").value;
            favourites.stations[i].url = document.getElementById("editStationURLInput").value;
            currentStation.name = document.getElementById("editStationNameInput").value;
            currentStation.favicon = document.getElementById("editStationFaviconInput").value;
            currentStation.url = document.getElementById("editStationURLInput").value;

            fetch("/setfavs", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(favourites)
            }).then(response => {
                renderFavourites();
                radio.src = currentStation.url;
                //radio.load();              
                updateUI();
            });
            modal.hide();
            break;
        }
    }
}

function newToast(message) {
    document.getElementById("toastMessage").innerHTML = (message);
    toast.show();
}

function getAudioMotionMode() {
    var mode = 12 - parseInt(window.innerWidth / 100)
    if (mode <= 2) {
        mode = 2;
    }
    if (mode >= 6) {
        mode = 6;
    }
    return mode;
}

function resizedWindowEvent() {
    var mode = getAudioMotionMode();
    if (mode != audioMotion.getOptions().mode) {
        audioMotion.setOptions({ mode: mode });
    };
}

radio.onvolumechange = function () {
    localStorage.setItem("volume", document.getElementById('radio').volume);
};

radio.onpause = function () {
    if (!radio.error) {
        nowPlaying.trackStream(undefined);
        if (document.getElementById("title_" + currentStation.uuid) != null) {
            document.getElementById("title_" + currentStation.uuid).innerHTML = "Paused";
            setStatusIcon("bi-play-circle");
        }
        document.title = currentStation.name;
    }
};

radio.onerror = function () {
    Array.from(document.getElementsByClassName("list-group-item")).forEach(element => {
        if (element.classList.contains("active") && element.classList.contains("fav")) {
            document.getElementById("title_" + currentStation.uuid).innerHTML = radio.error.message;
            setStatusIcon("bi-x-circle");
        }
    });
    newToast(radio.error.message);
    setMenu();
};

radio.onplay = function () {
    updateUI();
}

radio.onplaying = function () {
    if (document.getElementById("status_" + currentStation.uuid) != null) {
        setStatusIcon("bi-pause-circle");
    }
}

radio.onloadstart = function () {
    if (document.getElementById("status_" + currentStation.uuid) != null) {
        setStatusIcon("spinner-border");
    }
}

radio.onloadeddata = function () {
    if (document.getElementById("status_" + currentStation.uuid) != null) {
        setStatusIcon("bi-pause-circle");
    }
    playPromise = radio.play();
}

radio.onwaiting = function () {
    if (document.getElementById("status_" + currentStation.uuid) != null) {
        setStatusIcon("spinner-border");
    }
}

function setStatusIcon(icon) {
    document.getElementById("status_" + currentStation.uuid).classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
    document.getElementById("status_" + currentStation.uuid).classList.add(icon);
}

function updateUI() {
    var items = document.getElementsByClassName('list-group-item');
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
        if(items[i].classList.contains("fav")){
            if(items[i].childNodes[2].classList.contains("cover")){
                items[i].childNodes[2].classList.remove('cover');
                items[i].childNodes[2].src = favourites.stations.find(station => station.uuid === items[i].id).favicon;
            }
        }
        if (document.getElementById("title_" + items[i].id) != null && items[i].id != currentStation.uuid) {
            document.getElementById("title_" + items[i].id).innerHTML = "";
            document.getElementById("status_" + items[i].id).classList.remove("bi-play-circle", "bi-pause-circle", "spinner-border", "bi-x-circle");
        }
        if (items[i].id == currentStation.uuid) {
            if(items[i].classList.contains("fav")){
                items[i].childNodes[2].classList.add('cover');
            }        
            items[i].classList.add('active');
            if (document.getElementById("status_" + currentStation.uuid) != null && !radio.paused) {
                setStatusIcon("bi-pause-circle");
            }
        }
    }

    document.getElementById("dropdown_station").classList.remove("bi-bookmark-check");
    document.getElementById("dropdown_station").classList.add("bi-bookmark-x");
    if (document.getElementById(currentStation.uuid) != null) {
        if (document.getElementById(currentStation.uuid).classList.contains("fav")) {
            document.getElementById("dropdown_station").classList.remove("bi-bookmark-x");
            document.getElementById("dropdown_station").classList.add("bi-bookmark-check");
        }
    }
    document.getElementById("dropdown_station").innerHTML = " " + currentStation.name;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentStation.name,
            artwork: [{
                src: currentStation.favicon, type: 'image/png'
            }]
        });
    }
    if (!radio.paused) {
        if (document.getElementById(currentStation.uuid) != null) {
            if (document.getElementById(currentStation.uuid).classList.contains("fav")) {
                nowPlaying.trackStream(currentStation.url);
                nowPlaying.subscribe((info) => {
                    if (info.error) {
                        console.log(`Error captured with reason: ${info.error}`)
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
                    if (info.title != "") {
                        document.title = currentStation.name + " - " + info.title;
                    } else {
                        document.title = currentStation.name;
                    }
                })
            }
        }
    } else {
        if (document.getElementById("title_" + currentStation.uuid) != null) {
            console.log(radio.paused)
            document.getElementById("title_" + currentStation.uuid).innerHTML = "Paused";
            setStatusIcon("bi-play-circle");
        }
    }

    setMenu();
}


function setMenu() {
    document.getElementById("menuEdit").classList.add("disabled");
    document.getElementById("menuAdd").classList.add("disabled");
    document.getElementById("menuRemove").classList.add("disabled");
    document.getElementById("moveFavUp").classList.add("disabled");
    document.getElementById("moveFavDown").classList.add("disabled");

    var fav = false;
    var active = false;
    Array.from(document.getElementsByClassName("list-group-item")).forEach(element => {
        if (element.classList.contains("active")) {
            active = true;
            if (element.classList.contains("fav")) {
                fav = true;
            }
        }
    });
    if (active && fav) {
        document.getElementById("menuEdit").classList.remove("disabled");
        document.getElementById("menuRemove").classList.remove("disabled");
        document.getElementById("moveFavUp").classList.remove("disabled");
        document.getElementById("moveFavDown").classList.remove("disabled");

    }
    if (active && !fav) {
        document.getElementById("menuAdd").classList.remove("disabled");
    }
}

function closeSearchResults() {
    document.getElementById('searchResults').remove();
    setMenu();
}

async function fetchCover(title) {
    const escapedTitle = encodeURIComponent(title);
    const url = `/cover?title=${escapedTitle}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.coverUrl) {
            handleCoverResponse(data);
        } else {
            console.warn("Kein Cover gefunden für:", data.searchTerm);
            handleCoverResponse({ searchTerm: data.searchTerm, coverUrl: null });
        }
    } catch (error) {
        console.error("Fehler beim Abrufen des Covers:", error);
    }
}

function handleCoverResponse(data) {
    if (data.coverUrl) {
        document.getElementById("favicon_" + currentStation.uuid).src=data.coverUrl;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                artwork: [{
                    src: data.coverUrl, type: 'image/png'
                }]
            });
        }
    } else {
        document.getElementById("favicon_" + currentStation.uuid).src=currentStation.favicon;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                artwork: [{
                    src: currentStation.favicon, type: 'image/png'
                }]
            });
        }
    }
}
