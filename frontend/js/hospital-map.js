// ============================================================
// VIZITOR - Hospital & Location
// ============================================================

(function () {
    "use strict";

    // api.js already defines this globally
    const API_URL =
        window.VIZITOR_API_URL ||
        "https://vizitor.onrender.com";

    const DEFAULT_LOCATION = {
        latitude: 19.8135,
        longitude: 85.8312
    };

    let hospitals = [];
    let userLocation = null;
    let map = null;
    let userMarker = null;
    let hospitalMarker = null;
    let selectedHospital = null;

    const hospitalSelect = document.getElementById("hospitalSelect");
    const hospitalName = document.getElementById("selectedHospitalName");
    const hospitalAddress = document.getElementById("selectedHospitalAddress");
    const hospitalDistance = document.getElementById("selectedHospitalDistance");
    const hospitalCoordinates = document.getElementById("hospitalCoordinates");
    const directionsBtn = document.getElementById("hospitalDirectionsBtn");
    const hospitalMap = document.getElementById("hospitalMap");

    // ------------------------------------------------------------
    // Load Google Maps
    // ------------------------------------------------------------

    function loadGoogleMaps() {
        return new Promise((resolve, reject) => {

            if (window.google && window.google.maps) {
                resolve();
                return;
            }

            const existingScript =
                document.querySelector('script[data-vizitor-google-maps]');

            if (existingScript) {
                existingScript.addEventListener("load", resolve);
                existingScript.addEventListener("error", reject);
                return;
            }

            const script = document.createElement("script");

            /*
             * IMPORTANT:
             * Replace YOUR_GOOGLE_MAPS_KEY with the SAME Google Maps
             * key already used in your hospital-map.html.
             *
             * Do NOT put quotes around the key itself.
             */
            script.src =
                "https://maps.googleapis.com/maps/api/js?key=AIzaSyC607wKpIOjVXRR_Rw61v-_y4tvVKrobRo";

            script.async = true;
            script.defer = true;
            script.setAttribute("data-vizitor-google-maps", "true");

            script.onload = resolve;
            script.onerror = () =>
                reject(new Error("Google Maps failed to load."));

            document.head.appendChild(script);
        });
    }

    // ------------------------------------------------------------
    // Initialize map
    // ------------------------------------------------------------

    function initializeMap() {

        if (!window.google || !window.google.maps) {
            console.error("Google Maps is not available.");
            return;
        }

        const center = userLocation || DEFAULT_LOCATION;

        map = new google.maps.Map(hospitalMap, {
            center: {
                lat: center.latitude,
                lng: center.longitude
            },
            zoom: 12,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true
        });

        // User marker
        userMarker = new google.maps.Marker({
            position: {
                lat: center.latitude,
                lng: center.longitude
            },
            map: map,
            title: "Your Location",
            label: "U"
        });
    }

    // ------------------------------------------------------------
    // Get browser location
    // ------------------------------------------------------------

    function getUserLocation() {

        return new Promise((resolve) => {

            if (!navigator.geolocation) {
                console.warn("Geolocation is not supported.");
                resolve(DEFAULT_LOCATION);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {

                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };

                    console.log("User location:", location);

                    resolve(location);
                },
                (error) => {

                    console.warn(
                        "Could not get user location:",
                        error.message
                    );

                    // Fall back to Puri
                    resolve(DEFAULT_LOCATION);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
    }

    // ------------------------------------------------------------
    // Fetch hospitals
    // ------------------------------------------------------------

    async function loadHospitals() {

        try {

            hospitalSelect.innerHTML =
                '<option value="">Loading hospitals...</option>';

            const response = await fetch(
                `${API_URL}/hospitals`
            );

            if (!response.ok) {
                throw new Error(
                    `Hospital API returned ${response.status}`
                );
            }

            hospitals = await response.json();

            console.log("Hospitals loaded:", hospitals);

            if (!Array.isArray(hospitals) || hospitals.length === 0) {

                hospitalSelect.innerHTML =
                    '<option value="">No hospitals available</option>';

                return;
            }

            hospitalSelect.innerHTML =
                '<option value="">Select a hospital</option>';

            hospitals.forEach((hospital) => {

                const option = document.createElement("option");

                option.value = hospital.hospital_id;

                option.textContent =
                    hospital.name;

                hospitalSelect.appendChild(option);
            });

        } catch (error) {

            console.error(
                "Failed to load hospitals:",
                error
            );

            hospitalSelect.innerHTML =
                '<option value="">Unable to load hospitals</option>';
        }
    }

    // ------------------------------------------------------------
    // Get nearby hospitals with FastAPI distance
    // ------------------------------------------------------------

    async function loadNearbyHospitals() {

        try {

            const response = await fetch(
                `${API_URL}/hospitals/nearby` +
                `?latitude=${userLocation.latitude}` +
                `&longitude=${userLocation.longitude}`
            );

            if (!response.ok) {
                throw new Error(
                    `Nearby hospital API returned ${response.status}`
                );
            }

            const data = await response.json();

            console.log(
                "Nearby hospitals:",
                data
            );

            if (Array.isArray(data.hospitals)) {
                hospitals = data.hospitals;
            }

        } catch (error) {

            console.error(
                "Failed to load nearby hospitals:",
                error
            );
        }
    }

    // ------------------------------------------------------------
    // Hospital selection
    // ------------------------------------------------------------

    function handleHospitalSelection() {

        const hospitalId =
            hospitalSelect.value;

        if (!hospitalId) {

            selectedHospital = null;

            hospitalName.textContent =
                "Select a hospital";

            hospitalAddress.textContent =
                "Hospital information will appear here.";

            hospitalDistance.textContent =
                "--";

            hospitalCoordinates.textContent =
                "--";

            directionsBtn.disabled = true;

            if (hospitalMarker) {
                hospitalMarker.setMap(null);
                hospitalMarker = null;
            }

            return;
        }

        selectedHospital =
            hospitals.find(
                (hospital) =>
                    hospital.hospital_id === hospitalId
            );

        if (!selectedHospital) {
            console.error(
                "Hospital not found:",
                hospitalId
            );
            return;
        }

        displayHospital(selectedHospital);
    }

    // ------------------------------------------------------------
    // Display hospital
    // ------------------------------------------------------------

    function displayHospital(hospital) {

        hospitalName.textContent =
            hospital.name;

        hospitalAddress.textContent =
            hospital.address;

        if (hospital.distance_km !== undefined) {

            hospitalDistance.textContent =
                `${Number(hospital.distance_km).toFixed(2)} km`;

        } else {

            hospitalDistance.textContent =
                "--";
        }

        hospitalCoordinates.textContent =
            `${Number(hospital.latitude).toFixed(5)}, ` +
            `${Number(hospital.longitude).toFixed(5)}`;

        directionsBtn.disabled = false;

        showHospitalOnMap(hospital);
    }

    // ------------------------------------------------------------
    // Show selected hospital on map
    // ------------------------------------------------------------

    function showHospitalOnMap(hospital) {

        if (!map) {
            return;
        }

        const position = {
            lat: Number(hospital.latitude),
            lng: Number(hospital.longitude)
        };

        if (hospitalMarker) {
            hospitalMarker.setMap(null);
        }

        hospitalMarker =
            new google.maps.Marker({
                position: position,
                map: map,
                title: hospital.name,
                label: "H"
            });

        map.setCenter(position);
        map.setZoom(14);
    }

    // ------------------------------------------------------------
    // Open external Google Maps directions
    // ------------------------------------------------------------

    function openDirections() {

        if (!selectedHospital) {
            return;
        }

        const destination =
            `${selectedHospital.latitude},` +
            `${selectedHospital.longitude}`;

        let origin = "";

        if (userLocation) {

            origin =
                `&origin=${userLocation.latitude},` +
                `${userLocation.longitude}`;
        }

        const url =
            "https://www.google.com/maps/dir/?api=1" +
            `&destination=${encodeURIComponent(destination)}` +
            origin;

        window.open(
            url,
            "_blank"
        );
    }

    // ------------------------------------------------------------
    // Event listeners
    // ------------------------------------------------------------

    if (hospitalSelect) {

        hospitalSelect.addEventListener(
            "change",
            handleHospitalSelection
        );
    }

    if (directionsBtn) {

        directionsBtn.addEventListener(
            "click",
            openDirections
        );

        directionsBtn.disabled = true;
    }

    // ------------------------------------------------------------
    // Start hospital module
    // ------------------------------------------------------------

    async function initializeHospitalModule() {

        console.log(
            "Initializing VIZITOR Hospital module..."
        );

        userLocation =
            await getUserLocation();

        console.log(
            "Using location:",
            userLocation
        );

        // Load Google Maps
        try {

            await loadGoogleMaps();

            initializeMap();

        } catch (error) {

            console.error(
                "Google Maps initialization failed:",
                error
            );

            if (hospitalMap) {

                hospitalMap.textContent =
                    "Google Maps could not be loaded.";
            }
        }

        // Load hospital list
        await loadHospitals();

        // Load distances based on user location
        await loadNearbyHospitals();

        // Refresh dropdown with nearby sorted hospitals
        if (hospitals.length > 0) {

            hospitalSelect.innerHTML =
                '<option value="">Select a hospital</option>';

            hospitals.forEach((hospital) => {

                const option =
                    document.createElement("option");

                option.value =
                    hospital.hospital_id;

                option.textContent =
                    hospital.name;

                hospitalSelect.appendChild(option);
            });
        }

        console.log(
            "Hospital module ready."
        );
    }

    // ------------------------------------------------------------
    // Run after page loads
    // ------------------------------------------------------------

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeHospitalModule
        );

    } else {

        initializeHospitalModule();
    }

})();