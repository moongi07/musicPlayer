document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('file-input');
    const playlistElement = document.getElementById('playlist');
    const audioPlayer = document.getElementById('audio-player');
    const trackTitleElement = document.getElementById('track-title');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeElement = document.getElementById('current-time');
    const totalDurationElement = document.getElementById('total-duration');
    const prevButton = document.getElementById('prev-button');
    const playPauseButton = document.getElementById('play-pause-button');
    const nextButton = document.getElementById('next-button');
    const clearPlaylistButton = document.getElementById('clear-playlist-button');

    // State
    let playlist = []; // Array of { id, name, file, li, src }
    let currentSongIndex = -1;
    let db;

    // --- IndexedDB ---
    function initDB() {
        const request = indexedDB.open('retroMP3PlayerDB', 1);

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('songs')) {
                dbInstance.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            loadPlaylistFromDB();
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };
    }

    function saveSongsToDB(files, callback) {
        if (!db) return;
        const transaction = db.transaction(['songs'], 'readwrite');
        const store = transaction.objectStore('songs');
        
        // Clear existing songs before adding new ones
        store.clear().onsuccess = () => {
             Array.from(files).forEach(file => {
                if (file.type === "audio/mpeg") {
                    store.add({ name: file.name, file: file });
                }
            });
        };

        transaction.oncomplete = callback;
    }

    function loadPlaylistFromDB(autoplay = false) {
        if (!db) return;
        const transaction = db.transaction(['songs'], 'readonly');
        const store = transaction.objectStore('songs');
        const request = store.getAll();

        request.onsuccess = () => {
            resetPlayerState();
            const songsFromDB = request.result;

            if (songsFromDB.length === 0) {
                playlistElement.innerHTML = '<li class="placeholder">Sube tus archivos MP3...</li>';
                updateTrackInfo(null);
                return;
            }

            songsFromDB.forEach((songData, index) => {
                const li = document.createElement('li');
                li.textContent = songData.name.replace(/\.mp3$/i, '');
                li.dataset.index = index;

                const fileURL = URL.createObjectURL(songData.file);

                playlist.push({ ...songData, li, src: fileURL });

                li.addEventListener('click', () => playSong(index));
                playlistElement.appendChild(li);
            });

            if (playlist.length > 0) {
                currentSongIndex = 0;
                updateAudioSource(playlist[0]);
                if (autoplay) {
                    playSong(0);
                } else {
                    updateTrackInfo(playlist[0]);
                }
            }
        };
    }

    function clearDB() {
        if (!db) return;
        const transaction = db.transaction(['songs'], 'readwrite');
        const store = transaction.objectStore('songs');
        store.clear().onsuccess = () => {
            resetPlayerState();
            audioPlayer.src = '';
            updateTrackInfo(null);
            playlistElement.innerHTML = '<li class="placeholder">Sube tus archivos MP3...</li>';
        };
    }

    // --- Player Logic ---
    function playSong(index) {
        if (index < 0 || index >= playlist.length) return;
        
        currentSongIndex = index;
        const songItem = playlist[currentSongIndex];
        
        updateAudioSource(songItem);
        audioPlayer.play();

        playPauseButton.textContent = '❚❚';
        updatePlaylistUI();
        updateTrackInfo(songItem);
    }
    
    function handleFileUpload(event) {
        const files = event.target.files;
        if (files.length === 0) return;
        saveSongsToDB(files, () => loadPlaylistFromDB(true)); // Reload and autoplay
    }

    function togglePlayPause() {
        if (!audioPlayer.src) return;
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseButton.textContent = '❚❚';
        } else {
            audioPlayer.pause();
            playPauseButton.textContent = '►';
        }
    }

    const playNext = () => playlist.length > 0 && playSong((currentSongIndex + 1) % playlist.length);
    const playPrev = () => playlist.length > 0 && playSong((currentSongIndex - 1 + playlist.length) % playlist.length);

    // --- UI & State Updates ---
    function updateProgress() {
        if (audioPlayer.duration) {
            const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.value = audioPlayer.currentTime;
            currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
        }
    }

    function seek() {
        audioPlayer.currentTime = progressBar.value;
    }

    function updateTrackInfo(songItem) {
        if (songItem) {
            trackTitleElement.textContent = songItem.name.replace(/\.mp3$/i, '');
        } else {
            trackTitleElement.textContent = '-- NINGUNA CANCIÓN --';
            currentTimeElement.textContent = '00:00';
            totalDurationElement.textContent = '00:00';
            progressBar.value = 0;
        }
    }
    
    function updateAudioSource(songItem) {
        audioPlayer.src = songItem.src;
        audioPlayer.load(); // Important for loadedmetadata event
        audioPlayer.addEventListener('loadedmetadata', () => {
            progressBar.max = audioPlayer.duration;
            totalDurationElement.textContent = formatTime(audioPlayer.duration);
        }, { once: true });
    }

    function updatePlaylistUI() {
        playlist.forEach((item, index) => {
            item.li.classList.toggle('playing', index === currentSongIndex);
        });
    }

    function resetPlayerState() {
        playlist.forEach(item => URL.revokeObjectURL(item.src));
        playlist = [];
        playlistElement.innerHTML = '';
        currentSongIndex = -1;
        playPauseButton.textContent = '►';
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleFileUpload);
    playPauseButton.addEventListener('click', togglePlayPause);
    nextButton.addEventListener('click', playNext);
    prevButton.addEventListener('click', playPrev);
    clearPlaylistButton.addEventListener('click', clearDB);

    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    progressBar.addEventListener('input', seek);

    // --- Initialization ---
    initDB();
});