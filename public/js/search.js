
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

                if(station.url_resolved){
                    station.url = station.url_resolved;
                }
                
                listItem.onclick = function () {
                    clickStation(station.url, station.favicon, station.name, station.stationuuid);
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
