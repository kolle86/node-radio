/**
 * Show edit dialog
 */
function toggleEditModal() {
    const stationElement = document.getElementById(currentStation.uuid);
    if (!stationElement?.classList.contains("active") || !stationElement?.classList.contains("fav")) return;

    document.getElementById("editStationNameInput").value = currentStation.name;
    document.getElementById("editStationFaviconInput").value = currentStation.favicon;
    previewFavicon(currentStation.favicon)
    document.getElementById("editStationURLInput").value = currentStation.url;
    document.getElementById("editStationUidInput").value = currentStation.uuid;
    modal.show();
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